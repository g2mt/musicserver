package progress

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
)

type Event struct {
	Type string      `json:"type"` // "Value", "MaxValue", "AddOutput"
	Data interface{} `json:"data"`
}

type EventWithSource struct {
	Event
	Source string `json:"source"` // source name of event
}

type ProgressTicker struct {
	progress      *Progress
	value         atomic.Int32
	maxValue      atomic.Int32
	output        string
	outputMu      sync.Mutex
	eventChannels map[chan Event]chan Event
}

func (t *ProgressTicker) GetValue() int32 {
	return t.value.Load()
}

func (t *ProgressTicker) GetMaxValue() int32 {
	return t.maxValue.Load()
}

func (t *ProgressTicker) GetOutput() string {
	t.outputMu.Lock()
	defer t.outputMu.Unlock()
	return t.output
}

func (t *ProgressTicker) AddValue(d int32) {
	v := t.value.Add(d)
	t.emitEvent(Event{Type: "Value", Data: v})
}

func (t *ProgressTicker) SetValue(v int32) {
	t.value.Store(v)
	t.emitEvent(Event{Type: "Value", Data: v})
}

func (t *ProgressTicker) AddMaxValue(d int32) {
	v := t.maxValue.Add(d)
	t.emitEvent(Event{Type: "MaxValue", Data: v})
}

func (t *ProgressTicker) SetMaxValue(v int32) {
	t.maxValue.Store(v)
	t.emitEvent(Event{Type: "MaxValue", Data: v})
}

func (t *ProgressTicker) AddOutput(output string) {
	t.outputMu.Lock()
	t.output += output
	t.outputMu.Unlock()
	t.emitEvent(Event{Type: "AddOutput", Data: output})
}

func (t *ProgressTicker) emitEvent(event Event) {
	for ch := range t.eventChannels {
		select {
		case ch <- event:
		default:
		}
	}
	for globalChannel := range t.progress.globalEventChannel {
		select {
		case globalChannel <- EventWithSource{Event: event, Source: ""}:
		default:
		}
	}
}

func (t *ProgressTicker) addChannel() chan Event {
	if t.eventChannels == nil {
		t.eventChannels = make(map[chan Event]chan Event)
	}
	c := make(chan Event)
	t.eventChannels[c] = c
	return c
}

type Progress struct {
	progresses         map[string]*ProgressTicker
	globalEventChannel map[chan EventWithSource]chan EventWithSource
}

func NewProgress() *Progress {
	return &Progress{
		progresses:         make(map[string]*ProgressTicker),
		globalEventChannel: make(map[chan EventWithSource]chan EventWithSource),
	}
}

func (p *Progress) GetTicker(name string) (*ProgressTicker, bool) {
	t, b := p.progresses[name]
	return t, b
}

func (p *Progress) Bind(name string) (*ProgressTicker, error) {
	if strings.HasPrefix(name, ":") {
		panic("name cannot start with colon")
	}
	if _, ok := p.progresses[name]; ok {
		return nil, errors.New(name + " already bound")
	}
	ticker := &ProgressTicker{progress: p}
	p.progresses[name] = ticker
	return ticker, nil
}

func (p *Progress) Unbind(name string) {
	delete(p.progresses, name)
}

func (p *Progress) ListenEvents(name string) chan Event {
	if t, ok := p.progresses[name]; ok {
		return t.addChannel()
	} else {
		panic("invalid name")
	}
}

func (p *Progress) UnlistenEvents(name string, ch chan Event) {
	delete(p.progresses[name].eventChannels, ch)
}

func (p *Progress) ListenGlobalEvents() chan EventWithSource {
	c := make(chan EventWithSource)
	p.globalEventChannel[c] = c
	return c
}

func (p *Progress) UnlistenGlobalEvents(ch chan EventWithSource) {
	delete(p.globalEventChannel, ch)
}

func (p *Progress) ToJSON() ([]byte, error) {
	type progressJSON struct {
		Value    int32  `json:"value"`
		MaxValue int32  `json:"max_value"`
		Output   string `json:"output,omitempty"`
	}
	out := make(map[string]progressJSON)
	for name, ticker := range p.progresses {
		ticker.outputMu.Lock()
		out[name] = progressJSON{
			Value:    ticker.value.Load(),
			MaxValue: ticker.maxValue.Load(),
			Output:   ticker.output,
		}
		ticker.outputMu.Unlock()
	}
	return json.Marshal(out)
}
