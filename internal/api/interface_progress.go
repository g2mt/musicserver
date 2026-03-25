package api

func (i *Interface) GetProgress() ([]byte, error) {
	return i.prog.ToJSON()
}
