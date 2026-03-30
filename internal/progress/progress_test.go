package progress

import (
	"sync"
	"testing"
)

func TestSetValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	var wg sync.WaitGroup
	numGoroutines := 10
	iterations := 1000

	// Set value from multiple goroutines
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				ticker.SetValue(int32(j))
			}
		}()
	}

	wg.Wait()

	// The final value should be one of the set values (last iteration from some goroutine)
	// We just verify it's a valid int32 and the operation completed without panic
	_ = ticker.GetValue()
}

func TestAddValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	var wg sync.WaitGroup
	numGoroutines := 10
	iterations := 1000
	increment := int32(1)

	// Add value from multiple goroutines
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				ticker.AddValue(increment)
			}
		}()
	}

	wg.Wait()

	// The final value should be numGoroutines * iterations
	expected := int32(numGoroutines * iterations)
	actual := ticker.GetValue()
	if actual != expected {
		t.Errorf("expected %d, got %d", expected, actual)
	}
}

func TestSetMaxValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	var wg sync.WaitGroup
	numGoroutines := 10
	iterations := 1000

	// Set max value from multiple goroutines
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				ticker.SetMaxValue(int32(j))
			}
		}()
	}

	wg.Wait()

	// Verify it completed without panic
	_ = ticker.GetMaxValue()
}

func TestAddMaxValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	var wg sync.WaitGroup
	numGoroutines := 10
	iterations := 1000
	increment := int32(1)

	// Add max value from multiple goroutines
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				ticker.AddMaxValue(increment)
			}
		}()
	}

	wg.Wait()

	// The final max value should be numGoroutines * iterations
	expected := int32(numGoroutines * iterations)
	actual := ticker.GetMaxValue()
	if actual != expected {
		t.Errorf("expected %d, got %d", expected, actual)
	}
}
