(module
  ;; Memory configuration
  (import "env" "memory" (memory 256 1024))
  (import "env" "log_message" (func $log_message (param i32 i32)))
  (import "env" "update_heap_ptr" (func $update_heap_ptr (param i32)))
  
  ;; Export functions
  (export "alloc" (func $alloc))
  (export "dealloc" (func $dealloc))
  (export "build_hash_table" (func $build_hash_table))
  (export "search_hash_table" (func $search_hash_table))
  (export "clear_hash_table" (func $clear_hash_table))
  (export "get_memory_usage" (func $get_memory_usage))
  
  ;; Constants
  (global $HASH_TABLE_SIZE i32 (i32.const 65536))  ;; 2^16 buckets
  (global $ENTRY_SIZE i32 (i32.const 12))          ;; 3 x i32 per entry
  (global $BUCKET_SIZE i32 (i32.const 4))          ;; pointer per bucket
  (global $INITIAL_HEAP i32 (i32.const 1024))      ;; Initial heap position
  (global $ALIGNMENT i32 (i32.const 8))            ;; 8-byte alignment
  
  ;; Memory management globals
  (global $heap_ptr (mut i32) (i32.const 1024))
  (global $hash_table_base (mut i32) (i32.const 0))
  (global $entry_count (mut i32) (i32.const 0))
  (global $free_list_ptr (mut i32) (i32.const 0))  ;; Pointer to free list for memory reuse
  
  ;; Memory allocation with alignment
  (func $alloc (param $size i32) (result i32)
    (local $aligned_size i32)
    (local $ptr i32)
    
    ;; Align size to 8 bytes
    (local.set $aligned_size
      (i32.and
        (i32.add (local.get $size) (i32.const 7))
        (i32.const -8)  ;; Mask to align to 8
      )
    )
    
    ;; Check if we can reuse from free list
    (if (i32.ne (global.get $free_list_ptr) (i32.const 0))
      (then
        ;; Simple free list - just return the pointer and clear it
        (local.set $ptr (global.get $free_list_ptr))
        (global.set $free_list_ptr (i32.const 0))
        (return (local.get $ptr))
      )
    )
    
    ;; Allocate from heap
    (local.set $ptr (global.get $heap_ptr))
    (global.set $heap_ptr 
      (i32.add (global.get $heap_ptr) (local.get $aligned_size))
    )
    
    ;; Update JavaScript heap pointer
    (call $update_heap_ptr (global.get $heap_ptr))
    
    ;; Return pointer
    (local.get $ptr)
  )
  
  ;; Memory deallocation
  (func $dealloc (param $ptr i32) (param $size i32)
    ;; Add to free list for reuse
    (global.set $free_list_ptr (local.get $ptr))
    
    ;; Log deallocation
    ;; (call $log_message ...)
  )
  
  ;; FNV-1a Hash function
  (func $fnv1a_hash (param $ip i32) (result i32)
    (local $hash i32)
    (local $i i32)
    (local $byte i32)
    
    ;; FNV offset basis
    (local.set $hash (i32.const 2166136261))
    
    ;; Process each byte of the IP address
    (local.set $i (i32.const 0))
    (block $done
      (loop $hash_loop
        ;; Get byte
        (local.set $byte
          (i32.and
            (i32.shr_u 
              (local.get $ip) 
              (i32.mul (i32.sub (i32.const 3) (local.get $i)) (i32.const 8))
            )
            (i32.const 0xFF)
          )
        )
        
        ;; XOR hash with byte
        (local.set $hash (i32.xor (local.get $hash) (local.get $byte)))
        
        ;; Multiply by FNV prime
        (local.set $hash 
          (i32.mul (local.get $hash) (i32.const 16777619))
        )
        
        ;; Increment counter
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check if done
        (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
        (br $hash_loop)
      )
    )
    
    ;; Return hash (ensure positive)
    (i32.and (local.get $hash) (i32.const 0x7FFFFFFF))
  )
  
  ;; Build hash table from arrays
  (func $build_hash_table 
    (param $ip_array_ptr i32)
    (param $hash_array_ptr i32)
    (param $status_array_ptr i32)
    (param $count i32)
    
    (local $i i32)
    (local $table_size_bytes i32)
    (local $bucket_index i32)
    (local $entry_ptr i32)
    (local $ip_value i32)
    (local $hash_value i32)
    (local $status_value i32)
    
    ;; Calculate table size in bytes
    (local.set $table_size_bytes
      (i32.mul (global.get $HASH_TABLE_SIZE) (global.get $BUCKET_SIZE))
    )
    
    ;; Allocate hash table array
    (local.set $hash_table_base (call $alloc (local.get $table_size_bytes)))
    
    ;; Initialize all buckets to 0 (empty)
    (local.set $i (i32.const 0))
    (block $init_done
      (loop $init_loop
        ;; Set bucket to 0
        (i32.store
          (i32.add 
            (global.get $hash_table_base) 
            (i32.mul (local.get $i) (i32.const 4))
          )
          (i32.const 0)
        )
        
        ;; Increment
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check if done
        (br_if $init_done 
          (i32.ge_u (local.get $i) (global.get $HASH_TABLE_SIZE))
        )
        (br $init_loop)
      )
    )
    
    ;; Insert entries into hash table
    (local.set $i (i32.const 0))
    (block $insert_done
      (loop $insert_loop
        ;; Get values from arrays
        (local.set $ip_value 
          (i32.load (i32.add (local.get $ip_array_ptr) (i32.mul (local.get $i) (i32.const 4))))
        )
        (local.set $hash_value 
          (i32.load (i32.add (local.get $hash_array_ptr) (i32.mul (local.get $i) (i32.const 4))))
        )
        (local.set $status_value 
          (i32.load (i32.add (local.get $status_array_ptr) (i32.mul (local.get $i) (i32.const 4))))
        )
        
        ;; Calculate bucket index
        (local.set $bucket_index
          (i32.rem_u 
            (local.get $hash_value) 
            (global.get $HASH_TABLE_SIZE)
          )
        )
        
        ;; Allocate entry
        (local.set $entry_ptr (call $alloc (global.get $ENTRY_SIZE)))
        
        ;; Store entry data
        (i32.store (local.get $entry_ptr) (local.get $hash_value))
        (i32.store (i32.add (local.get $entry_ptr) (i32.const 4)) (local.get $ip_value))
        (i32.store (i32.add (local.get $entry_ptr) (i32.const 8)) (local.get $status_value))
        
        ;; Link entry to bucket (chaining)
        (i32.store 
          (i32.add 
            (global.get $hash_table_base) 
            (i32.mul (local.get $bucket_index) (i32.const 4))
          )
          (local.get $entry_ptr)
        )
        
        ;; Increment entry count
        (global.set $entry_count 
          (i32.add (global.get $entry_count) (i32.const 1))
        )
        
        ;; Increment counter
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check if done
        (br_if $insert_done (i32.ge_u (local.get $i) (local.get $count)))
        (br $insert_loop)
      )
    )
    
    ;; Log completion
    ;; (call $log_message ...)
  )
  
  ;; Search hash table for IP
  (func $search_hash_table (param $ip i32) (result i32)
    (local $hash_value i32)
    (local $bucket_index i32)
    (local $entry_ptr i32)
    (local $stored_ip i32)
    (local $stored_status i32)
    (local $result_ptr i32)
    (local $found i32)
    (local $entries_in_bucket i32)
    
    ;; Calculate hash
    (local.set $hash_value (call $fnv1a_hash (local.get $ip)))
    
    ;; Calculate bucket index
    (local.set $bucket_index
      (i32.rem_u (local.get $hash_value) (global.get $HASH_TABLE_SIZE))
    )
    
    ;; Get bucket pointer
    (local.set $entry_ptr
      (i32.load 
        (i32.add 
          (global.get $hash_table_base) 
          (i32.mul (local.get $bucket_index) (i32.const 4))
        )
      )
    )
    
    ;; Initialize counters
    (local.set $found (i32.const 0))
    (local.set $entries_in_bucket (i32.const 0))
    (local.set $stored_status (i32.const 0))
    
    ;; Search through bucket entries
    (block $search_done
      (loop $search_loop
        ;; Check if entry exists
        (if (i32.eq (local.get $entry_ptr) (i32.const 0))
          (then
            (br $search_done)
          )
        )
        
        ;; Increment entries counter
        (local.set $entries_in_bucket 
          (i32.add (local.get $entries_in_bucket) (i32.const 1))
        )
        
        ;; Get stored IP
        (local.set $stored_ip 
          (i32.load (i32.add (local.get $entry_ptr) (i32.const 4)))
        )
        
        ;; Compare IPs
        (if (i32.eq (local.get $stored_ip) (local.get $ip))
          (then
            ;; Found!
            (local.set $found (i32.const 1))
            (local.set $stored_status 
              (i32.load (i32.add (local.get $entry_ptr) (i32.const 8)))
            )
            (br $search_done)
          )
        )
        
        ;; Move to next entry (not implemented in simple version)
        (local.set $entry_ptr (i32.const 0))
      )
    )
    
    ;; Allocate result array
    (local.set $result_ptr (call $alloc (i32.const 16)))
    
    ;; Store results
    (i32.store (local.get $result_ptr) (local.get $found))
    (i32.store (i32.add (local.get $result_ptr) (i32.const 4)) (local.get $stored_status))
    (i32.store (i32.add (local.get $result_ptr) (i32.const 8)) (local.get $bucket_index))
    (i32.store (i32.add (local.get $result_ptr) (i32.const 12)) (local.get $entries_in_bucket))
    
    ;; Return result pointer
    (local.get $result_ptr)
  )
  
  ;; Clear hash table and reset heap
  (func $clear_hash_table
    (local $i i32)
    
    ;; Reset all buckets to 0
    (local.set $i (i32.const 0))
    (block $clear_done
      (loop $clear_loop
        ;; Check if hash table exists
        (if (i32.ne (global.get $hash_table_base) (i32.const 0))
          (then
            ;; Clear bucket
            (i32.store
              (i32.add 
                (global.get $hash_table_base) 
                (i32.mul (local.get $i) (i32.const 4))
              )
              (i32.const 0)
            )
          )
        )
        
        ;; Increment
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check if done
        (br_if $clear_done 
          (i32.ge_u (local.get $i) (global.get $HASH_TABLE_SIZE))
        )
        (br $clear_loop)
      )
    )
    
    ;; Reset heap pointer to initial position
    (global.set $heap_ptr (global.get $INITIAL_HEAP))
    (global.set $entry_count (i32.const 0))
    (global.set $hash_table_base (i32.const 0))
    (global.set $free_list_ptr (i32.const 0))
    
    ;; Update JavaScript heap pointer
    (call $update_heap_ptr (global.get $heap_ptr))
  )
  
  ;; Get current memory usage
  (func $get_memory_usage (result i32)
    (global.get $heap_ptr)
  )
)
