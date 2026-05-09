package api

type Request struct {
	Path    string
	Method  string
	Params  map[string]string
	FromIPC bool
}

type GenericInterface interface {
	HandleRequest(req *Request) (handler, string, error)
}
