package progress

import (
	"encoding/json"
	"errors"
	"sync/atomic"
)

type ProgressTicker struct {
	Value    atomic.Int32 `json:"value"`
	MaxValue atomic.Int32 `json:"max_value"`
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
	return json.Marshal(p.progresses)
}
