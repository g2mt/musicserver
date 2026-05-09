package api

type GenericInterface interface {
	handleRequest(path string, method string, params map[string]string) (handler, string, error)
}
