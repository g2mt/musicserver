package progress

import (
	"sync"
	"testing"
)

// testConcurrentModify runs a concurrent test with the given modify function.
// It spawns numGoroutines, each running iterations times, calling modify each iteration.
// Then it asserts that the final value matches the expected value using getValue.
func testConcurrentModify(
	t *testing.T,
	modify func(int32),
	getValue func() int32,
	expected int32,
	numGoroutines int,
	iterations int,
) {
	var wg sync.WaitGroup
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				modify(int32(j))
			}
		}()
	}

	wg.Wait()

	actual := getValue()
	if actual != expected {
		t.Errorf("expected %d, got %d", expected, actual)
	}
}

// testConcurrentAdd runs a concurrent test that adds a fixed increment.
// It spawns numGoroutines, each running iterations times, adding increment each iteration.
// Then it asserts that the final value matches the expected value using getValue.
func testConcurrentAdd(
	t *testing.T,
	add func(int32),
	getValue func() int32,
	increment int32,
	expected int32,
	numGoroutines int,
	iterations int,
) {
	var wg sync.WaitGroup
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				add(increment)
			}
		}()
	}

	wg.Wait()

	actual := getValue()
	if actual != expected {
		t.Errorf("expected %d, got %d", expected, actual)
	}
}

func TestSetValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	numGoroutines := 10
	iterations := 1000

	testConcurrentModify(
		t,
		func(v int32) { ticker.SetValue(1234) },
		ticker.GetValue,
		1234,
		numGoroutines,
		iterations,
	)
}

func TestAddValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	numGoroutines := 10
	iterations := 1000
	increment := int32(1)
	expected := int32(numGoroutines * iterations)

	testConcurrentAdd(
		t,
		ticker.AddValue,
		ticker.GetValue,
		increment,
		expected,
		numGoroutines,
		iterations,
	)
}

func TestSetMaxValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	numGoroutines := 10
	iterations := 1000

	testConcurrentModify(
		t,
		func(v int32) { ticker.SetMaxValue(1234) },
		ticker.GetMaxValue,
		1234,
		numGoroutines,
		iterations,
	)
}

func TestAddMaxValueConcurrent(t *testing.T) {
	p := NewProgress()
	ticker, err := p.Bind("test")
	if err != nil {
		t.Fatalf("failed to bind: %v", err)
	}

	numGoroutines := 10
	iterations := 1000
	increment := int32(1)
	expected := int32(numGoroutines * iterations)

	testConcurrentAdd(
		t,
		ticker.AddMaxValue,
		ticker.GetMaxValue,
		increment,
		expected,
		numGoroutines,
		iterations,
	)
}
