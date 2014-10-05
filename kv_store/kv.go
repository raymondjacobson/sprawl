// Simple Go Key-Value store
package main

import (
  "github.com/go-martini/martini"
)
var KV_STORE = make(map[string]string)
func GetValue(params martini.Params) string {
  return KV_STORE[params["id"]]
}
func PutValue(params martini.Params) string {
  KV_STORE[params["key"]] = params["value"]
  return "Put"
}
func main() {
  m := martini.Classic()
  m.Get("/get/:id", GetValue)
  m.Get("/put/:key/:value", PutValue)
  m.Run()
}