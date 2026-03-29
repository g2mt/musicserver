package api

import "musicserver/internal/schema"

type Props struct {
	Version string         `json:"version"`
	Config  *schema.Config `json:"config"`
}

func (i *Interface) GetProps() *Props {
	return &Props{
		Version: Version,
		Config:  i.config,
	}
}
