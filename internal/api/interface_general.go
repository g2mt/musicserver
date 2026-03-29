package api

import (
	"musicserver/internal/progress"
	"musicserver/internal/schema"
)

// GetScanTicker returns the active scan ProgressTicker if a scan is running.
func (i *Interface) GetScanTicker() *progress.ProgressTicker {
	return i.scan.ticker.Load()
}

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
