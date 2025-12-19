// Go Test File
package main

import (
	"fmt"
	"strings"
	"time"
	_ "database/sql"
)

// Using: fmt, strings, database/sql (blank import)
// Unused: time

func main() {
	message := "Hello, World!"
	upper := strings.ToUpper(message)
	fmt.Println(upper)
}
