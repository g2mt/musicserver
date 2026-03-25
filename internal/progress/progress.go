package progress

import (
	"encoding/json"
	"errors"
	"sync/atomic"
)

type Event struct {
	Type string      `json:"type"` // "Value", "MaxValue"
	Data interface{} `json:"data"`
}

type ProgressTicker struct {
	value         atomic.Int32
	maxValue      atomic.Int32
	eventChannels map[chan Event]chan Event
}

type Progress struct {
	progresses map[string]*ProgressTicker
}

func NewProgress() *Progress {
	return &Progress{
		progresses: make(map[string]*ProgressTicker),
	}
}

func (p *Progress) Bind(name string) (*ProgressTicker, error) {
	if _, ok := p.progresses[name]; ok {
		return nil, errors.New(name + " already bound")
	}
	ticker := &ProgressTicker{}
	p.progresses[name] = ticker
	return ticker, nil
}

func (p *Progress) Unbind(name string) {
	delete(p.progresses, name)
}

func (p *Progress) ListenEvents(name string) chan Event {
	if pr, ok := p.progresses[name]; ok {
		if pr.eventChannels == nil {
			pr.eventChannels = make(map[chan Event]chan Event)
		}
		c := make(chan Event)
		pr.eventChannels[c] = c
		return c
	} else {
		panic("invalid name")
	}
}

func (p *Progress) UnlistenEvents(name string, ch chan Event) {
	delete(p.progresses[name].eventChannels, ch)
}

func (p *Progress) ToJSON() ([]byte, error) {
	type progressJSON struct {
		Value    int32 `json:"value"`
		MaxValue int32 `json:"max_value"`
	}
	out := make(map[string]progressJSON)
	for name, ticker := range p.progresses {
		MaxValue := ticker.MaxValue.Load()
		if MaxValue > 0 {
			out[name] = progressJSON{
				Value:    ticker.Value.Load(),
				MaxValue: ticker.MaxValue.Load(),
			}
		}
	}
	return json.Marshal(out)
}
