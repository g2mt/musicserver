package progress

import (
	"encoding/json"
	"errors"
	"sync/atomic"
)

type ProgressTicker struct {
	Value    atomic.Int32
	MaxValue atomic.Int32
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
