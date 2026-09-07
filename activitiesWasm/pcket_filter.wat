(module
  ;; Memory configuration
  (import "env" "memory" (memory 256 1024))
  (import "env" "log_packet" (func $log_packet (param i32 i32)))
  (import "env" "block_packet" (func $block_packet (param i32 i32)))
  
  ;; Export functions
  (export "alloc" (func $alloc))
  (export "inspect_packet" (func $inspect_packet))
  (export "analyze_payload" (func $analyze_payload))
  (export "detect_tracker" (func $detect_tracker))
  
  ;; Memory management
  (global $heap_ptr (mut i32) (i32.const 1024))
  
  ;; Tracker signature hash table
  ;; Format: [hash_value(4)][tracker_type_offset(4)][risk_level(4)]
  (global $TRACKER_DB_SIZE i32 (i32.const 256))
  (global $TRACKER_ENTRY_SIZE i32 (i32.const 12))
  
  ;; Alloc function
  (func $alloc (param $size i32) (result i32)
    (local $aligned_size i32)
    (local $ptr i32)
    
    ;; Align to 8 bytes
    (local.set $aligned_size
      (i32.and
        (i32.add (local.get $size) (i32.const 7))
        (i32.const -8)
      )
    )
    
    ;; Allocate
    (local.set $ptr (global.get $heap_ptr))
    (global.set $heap_ptr 
      (i32.add (global.get $heap_ptr) (local.get $aligned_size))
    )
    
    (local.get $ptr)
  )
  
  ;; FNV-1a Hash for tracker patterns
  (func $fnv1a_hash (param $str_ptr i32) (param $str_len i32) (result i32)
    (local $hash i32)
    (local $i i32)
    (local $byte i32)
    
    ;; FNV offset basis
    (local.set $hash (i32.const 2166136261))
    
    ;; Hash each byte
    (local.set $i (i32.const 0))
    (block $hash_done
      (loop $hash_loop
        ;; Check if done
        (br_if $hash_done (i32.ge_u (local.get $i) (local.get $str_len)))
        
        ;; Get byte
        (local.set $byte
          (i32.load8_u (i32.add (local.get $str_ptr) (local.get $i)))
        )
        
        ;; XOR with hash
        (local.set $hash (i32.xor (local.get $hash) (local.get $byte)))
        
        ;; Multiply by prime
        (local.set $hash (i32.mul (local.get $hash) (i32.const 16777619)))
        
        ;; Increment
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        (br $hash_loop)
      )
    )
    
    ;; Return positive hash
    (i32.and (local.get $hash) (i32.const 0x7FFFFFFF))
  )
  
  ;; String contains pattern check
  (func $string_contains 
    (param $str_ptr i32) 
    (param $str_len i32)
    (param $pattern_ptr i32)
    (param $pattern_len i32)
    (result i32)
    
    (local $i i32)
    (local $j i32)
    (local $found i32)
    
    ;; Simple substring search
    (local.set $i (i32.const 0))
    (block $search_done
      (loop $outer_loop
        ;; Check if we've searched all positions
        (if (i32.gt_u 
              (local.get $i) 
              (i32.sub (local.get $str_len) (local.get $pattern_len)))
          (then
            (return (i32.const 0))  ;; Not found
          )
        )
        
        ;; Check pattern at position i
        (local.set $j (i32.const 0))
        (local.set $found (i32.const 1))
        
        (block $inner_done
          (loop $inner_loop
            ;; Check if pattern matched
            (br_if $inner_done 
              (i32.ge_u (local.get $j) (local.get $pattern_len))
            )
            
            ;; Compare bytes
            (if 
              (i32.ne
                (i32.load8_u (i32.add (local.get $str_ptr) 
                                      (i32.add (local.get $i) (local.get $j))))
                (i32.load8_u (i32.add (local.get $pattern_ptr) (local.get $j)))
              )
              (then
                (local.set $found (i32.const 0))
                (br $inner_done)
              )
            )
            
            ;; Increment j
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $inner_loop)
          )
        )
        
        ;; Check if found
        (if (i32.eq (local.get $found) (i32.const 1))
          (then
            (return (i32.const 1))  ;; Found
          )
        )
        
        ;; Increment i
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $outer_loop)
      )
    )
    
    (i32.const 0)  ;; Not found
  )
  
  ;; Detect tracker from packet data
  (func $detect_tracker 
    (param $packet_ptr i32) 
    (param $packet_len i32)
    (result i32)  ;; Returns tracker type ID (0 = none)
    
    (local $tracker_id i32)
    (local $i i32)
    
    ;; Known tracker patterns (simplified for WASM)
    ;; Pattern hash table would be initialized here
    
    ;; For demo, check common patterns
    ;; In real implementation, this would use the hash table
    
    ;; Return 0 (no tracker) for now
    ;; The JavaScript side handles the actual detection
    (i32.const 0)
  )
  
  ;; Analyze packet payload
  (func $analyze_payload 
    (param $payload_ptr i32) 
    (param $payload_len i32)
    (result i32)  ;; Returns analysis result pointer
    
    (local $result_ptr i32)
    (local $hash_value i32)
    (local $contains_tracker i32)
    
    ;; Calculate hash of payload
    (local.set $hash_value 
      (call $fnv1a_hash (local.get $payload_ptr) (local.get $payload_len))
    )
    
    ;; Allocate result (16 bytes = 4 x i32)
    (local.set $result_ptr (call $alloc (i32.const 16)))
    
    ;; Store results
    (i32.store (local.get $result_ptr) (local.get $hash_value))  ;; [0] payload hash
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 4)) 
      (i32.const 0)  ;; [1] tracker flag
    )
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 8)) 
      (i32.const 0)  ;; [2] risk level
    )
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 12)) 
      (i32.const 0)  ;; [3] reserved
    )
    
    ;; Return result pointer
    (local.get $result_ptr)
  )
  
  ;; Main packet inspection function
  (func $inspect_packet 
    (param $packet_ptr i32) 
    (param $packet_len i32)
    (result i32)  ;; Returns inspection result
    
    (local $result_ptr i32)
    (local $tracker_detected i32)
    (local $risk_level i32)
    (local $tracker_type_id i32)
    
    ;; Detect tracker
    (local.set $tracker_type_id 
      (call $detect_tracker (local.get $packet_ptr) (local.get $packet_len))
    )
    
    ;; Set flags based on detection
    (if (i32.gt_u (local.get $tracker_type_id) (i32.const 0))
      (then
        (local.set $tracker_detected (i32.const 1))
        (local.set $risk_level (i32.const 2))  ;; High risk
      )
      (else
        (local.set $tracker_detected (i32.const 0))
        (local.set $risk_level (i32.const 0))  ;; No risk
      )
    )
    
    ;; Allocate result structure (20 bytes = 5 x i32)
    (local.set $result_ptr (call $alloc (i32.const 20)))
    
    ;; Store inspection results
    (i32.store (local.get $result_ptr) (local.get $tracker_detected))  ;; [0] is_tracker
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 4)) 
      (local.get $tracker_type_id)  ;; [1] tracker type
    )
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 8)) 
      (local.get $risk_level)  ;; [2] risk level
    )
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 12)) 
      (local.get $packet_len)  ;; [3] packet size
    )
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 16)) 
      (i32.const 0)  ;; [4] reserved
    )
    
    ;; Log inspection
    ;; (call $log_packet (local.get $packet_ptr) (local.get $packet_len))
    
    ;; Return result pointer
    (local.get $result_ptr)
  )
)
