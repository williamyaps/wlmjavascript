(module
  ;; Memory configuration
  (import "env" "memory" (memory 256 1024))
  (import "env" "log_message" (func $log_message (param i32 i32)))
  (import "env" "update_heap_ptr" (func $update_heap_ptr (param i32)))
  
  ;; Export functions
  (export "alloc" (func $alloc))
  (export "build_hash_table" (func $build_hash_table))
  (export "search_hash_table" (func $search_hash_table))
  (export "insert_entry" (func $insert_entry))
  (export "delete_entry" (func $delete_entry))
  (export "clear_hash_table" (func $clear_hash_table))
  (export "get_memory_usage" (func $get_memory_usage))
  (export "get_collision_count" (func $get_collision_count))
  
  ;; Constants
  (global $TABLE_SIZE i32 (i32.const 131072))     ;; 2^17 slots (lebih besar untuk mengurangi collision)
  (global $ENTRY_SIZE i32 (i32.const 12))          ;; 12 bytes per entry
  (global $EMPTY_SLOT i32 (i32.const 0))           ;; Marker untuk slot kosong
  (global $DELETED_SLOT i32 (i32.const -1))        ;; Marker untuk slot yang dihapus
  (global $INITIAL_HEAP i32 (i32.const 1024))
  (global $ALIGNMENT i32 (i32.const 8))
  
  ;; Memory management globals
  (global $heap_ptr (mut i32) (i32.const 1024))
  (global $hash_table_base (mut i32) (i32.const 0))
  (global $entry_count (mut i32) (i32.const 0))
  (global $collision_count (mut i32) (i32.const 0))
  (global $probe_count (mut i32) (i32.const 0))
  
  ;; Memory allocation dengan alignment
  (func $alloc (param $size i32) (result i32)
    (local $aligned_size i32)
    (local $ptr i32)
    
    ;; Align size ke 8 bytes
    (local.set $aligned_size
      (i32.and
        (i32.add (local.get $size) (i32.const 7))
        (i32.const -8)
      )
    )
    
    ;; Allocate dari heap
    (local.set $ptr (global.get $heap_ptr))
    (global.set $heap_ptr 
      (i32.add (global.get $heap_ptr) (local.get $aligned_size))
    )
    
    ;; Update JavaScript heap pointer
    (call $update_heap_ptr (global.get $heap_ptr))
    
    (local.get $ptr)
  )
  
  ;; FNV-1a Hash function (menghasilkan 32-bit hash)
  (func $fnv1a_hash (param $ip i32) (result i32)
    (local $hash i32)
    (local $i i32)
    (local $byte i32)
    
    ;; FNV offset basis
    (local.set $hash (i32.const 2166136261))
    
    ;; Process 4 bytes
    (local.set $i (i32.const 0))
    (block $hash_done
      (loop $hash_loop
        ;; Extract byte (from MSB to LSB)
        (local.set $byte
          (i32.and
            (i32.shr_u 
              (local.get $ip) 
              (i32.mul 
                (i32.sub (i32.const 3) (local.get $i)) 
                (i32.const 8)
              )
            )
            (i32.const 0xFF)
          )
        )
        
        ;; XOR with byte
        (local.set $hash (i32.xor (local.get $hash) (local.get $byte)))
        
        ;; Multiply by FNV prime
        (local.set $hash (i32.mul (local.get $hash) (i32.const 16777619)))
        
        ;; Increment
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check if done
        (br_if $hash_done (i32.ge_u (local.get $i) (i32.const 4)))
        (br $hash_loop)
      )
    )
    
    ;; Return positive hash
    (i32.and (local.get $hash) (i32.const 0x7FFFFFFF))
  )
  
  ;; Calculate entry offset dari slot index
  (func $get_entry_offset (param $slot_index i32) (result i32)
    (i32.mul (local.get $slot_index) (global.get $ENTRY_SIZE))
  )
  
  ;; Read entry dari hash table
  ;; Returns: 0 jika kosong, -1 jika deleted, atau pointer ke data
  (func $read_entry_hash (param $slot_index i32) (result i32)
    (local $entry_ptr i32)
    
    ;; Calculate entry pointer
    (local.set $entry_ptr
      (i32.add 
        (global.get $hash_table_base)
        (call $get_entry_offset (local.get $slot_index))
      )
    )
    
    ;; Return hash value (first 4 bytes)
    (i32.load (local.get $entry_ptr))
  )
  
  ;; Write entry ke hash table
  (func $write_entry 
    (param $slot_index i32)
    (param $hash_value i32)
    (param $ip_value i32)
    (param $status_value i32)
    
    (local $entry_ptr i32)
    
    ;; Calculate entry pointer
    (local.set $entry_ptr
      (i32.add 
        (global.get $hash_table_base)
        (call $get_entry_offset (local.get $slot_index))
      )
    )
    
    ;; Store entry data (12 bytes)
    (i32.store (local.get $entry_ptr) (local.get $hash_value))
    (i32.store 
      (i32.add (local.get $entry_ptr) (i32.const 4)) 
      (local.get $ip_value)
    )
    (i32.store 
      (i32.add (local.get $entry_ptr) (i32.const 8)) 
      (local.get $status_value)
    )
  )
  
  ;; Build hash table dengan linear probing
  (func $build_hash_table 
    (param $ip_array_ptr i32)
    (param $status_array_ptr i32)
    (param $count i32)
    
    (local $i i32)
    (local $table_size_bytes i32)
    (local $ip_value i32)
    (local $status_value i32)
    (local $hash_value i32)
    (local $slot_index i32)
    (local $probe_count_local i32)
    
    ;; Calculate table size
    (local.set $table_size_bytes
      (i32.mul (global.get $TABLE_SIZE) (global.get $ENTRY_SIZE))
    )
    
    ;; Allocate hash table
    (local.set $hash_table_base (call $alloc (local.get $table_size_bytes)))
    
    ;; Initialize all slots to EMPTY (0)
    (local.set $i (i32.const 0))
    (block $init_done
      (loop $init_loop
        ;; Set slot to EMPTY
        (call $write_entry 
          (local.get $i)
          (global.get $EMPTY_SLOT)  ;; hash = 0 (empty)
          (i32.const 0)              ;; ip = 0
          (i32.const 0)              ;; status = 0
        )
        
        ;; Increment
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check if done
        (br_if $init_done (i32.ge_u (local.get $i) (global.get $TABLE_SIZE)))
        (br $init_loop)
      )
    )
    
    ;; Insert entries dengan linear probing
    (local.set $i (i32.const 0))
    (block $insert_done
      (loop $insert_loop
        ;; Get values dari arrays
        (local.set $ip_value 
          (i32.load 
            (i32.add 
              (local.get $ip_array_ptr) 
              (i32.mul (local.get $i) (i32.const 4))
            )
          )
        )
        (local.set $status_value 
          (i32.load 
            (i32.add 
              (local.get $status_array_ptr) 
              (i32.mul (local.get $i) (i32.const 4))
            )
          )
        )
        
        ;; Calculate hash
        (local.set $hash_value (call $fnv1a_hash (local.get $ip_value)))
        
        ;; Calculate initial slot
        (local.set $slot_index
          (i32.rem_u (local.get $hash_value) (global.get $TABLE_SIZE))
        )
        
        ;; Linear probing untuk menemukan slot kosong
        (local.set $probe_count_local (i32.const 0))
        (block $probe_done
          (loop $probe_loop
            ;; Check jika slot kosong atau deleted
            (local.set $probe_count_local 
              (i32.add (local.get $probe_count_local) (i32.const 1))
            )
            
            ;; Read slot hash
            (if 
              (i32.or
                (i32.eq 
                  (call $read_entry_hash (local.get $slot_index)) 
                  (global.get $EMPTY_SLOT)
                )
                (i32.eq 
                  (call $read_entry_hash (local.get $slot_index)) 
                  (global.get $DELETED_SLOT)
                )
              )
              (then
                ;; Found empty slot, write entry
                (call $write_entry 
                  (local.get $slot_index)
                  (local.get $hash_value)
                  (local.get $ip_value)
                  (local.get $status_value)
                )
                
                ;; Update collision count jika probing terjadi
                (if (i32.gt_u (local.get $probe_count_local) (i32.const 1))
                  (then
                    (global.set $collision_count 
                      (i32.add (global.get $collision_count) (i32.const 1))
                    )
                    (global.set $probe_count 
                      (i32.add 
                        (global.get $probe_count) 
                        (local.get $probe_count_local)
                      )
                    )
                  )
                )
                
                ;; Increment entry count
                (global.set $entry_count 
                  (i32.add (global.get $entry_count) (i32.const 1))
                )
                
                (br $probe_done)
              )
            )
            
            ;; Move ke slot berikutnya (linear probing)
            (local.set $slot_index
              (i32.rem_u
                (i32.add (local.get $slot_index) (i32.const 1))
                (global.get $TABLE_SIZE)
              )
            )
            
            ;; Check jika tabel penuh
            (if (i32.ge_u (local.get $probe_count_local) (global.get $TABLE_SIZE))
              (then
                ;; Table is full
                (br $probe_done)
              )
            )
            
            (br $probe_loop)
          )
        )
        
        ;; Increment
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Check jika done
        (br_if $insert_done (i32.ge_u (local.get $i) (local.get $count)))
        (br $insert_loop)
      )
    )
  )
  
  ;; Search hash table dengan linear probing
  ;; Parameter: $ip - IP address yang dicari (packed i32)
  ;; Returns: pointer ke result array [found, status, slot_index, probes]
  (func $search_hash_table (param $ip i32) (result i32)
    (local $hash_value i32)
    (local $slot_index i32)
    (local $initial_slot i32)
    (local $current_hash i32)
    (local $current_ip i32)
    (local $current_status i32)
    (local $probes i32)
    (local $found i32)
    (local $result_ptr i32)
    
    ;; Calculate hash untuk IP yang dicari
    (local.set $hash_value (call $fnv1a_hash (local.get $ip)))
    
    ;; Calculate initial slot
    (local.set $slot_index
      (i32.rem_u (local.get $hash_value) (global.get $TABLE_SIZE))
    )
    (local.set $initial_slot (local.get $slot_index))
    
    ;; Initialize variables
    (local.set $probes (i32.const 0))
    (local.set $found (i32.const 0))
    (local.set $current_status (i32.const 0))
    
    ;; Linear probing search
    (block $search_done
      (loop $search_loop
        ;; Increment probe count
        (local.set $probes (i32.add (local.get $probes) (i32.const 1)))
        
        ;; Read hash dari current slot
        (local.set $current_hash 
          (call $read_entry_hash (local.get $slot_index))
        )
        
        ;; Check jika slot kosong
        (if (i32.eq (local.get $current_hash) (global.get $EMPTY_SLOT))
          (then
            ;; Not found - mencapai slot kosong
            (br $search_done)
          )
        )
        
        ;; Check jika slot deleted - skip
        (if (i32.eq (local.get $current_hash) (global.get $DELETED_SLOT))
          (then
            ;; Skip deleted slot, continue probing
            (br $search_continue)
          )
        )
        
        ;; Read IP dari current slot
        (local.set $current_ip
          (i32.load
            (i32.add
              (i32.add 
                (global.get $hash_table_base)
                (call $get_entry_offset (local.get $slot_index))
              )
              (i32.const 4)  ;; Offset untuk IP field
            )
          )
        )
        
        ;; Compare IP addresses
        (if (i32.eq (local.get $current_ip) (local.get $ip))
          (then
            ;; Found! Read status
            (local.set $found (i32.const 1))
            (local.set $current_status
              (i32.load
                (i32.add
                  (i32.add 
                    (global.get $hash_table_base)
                    (call $get_entry_offset (local.get $slot_index))
                  )
                  (i32.const 8)  ;; Offset untuk status field
                )
              )
            )
            (br $search_done)
          )
        )
        
        ;; Label untuk continue
        (block $search_continue_block
          ;; Move ke slot berikutnya
          (local.set $slot_index
            (i32.rem_u
              (i32.add (local.get $slot_index) (i32.const 1))
              (global.get $TABLE_SIZE)
            )
          )
          
          ;; Check jika kembali ke initial slot (full circle)
          (if (i32.eq (local.get $slot_index) (local.get $initial_slot))
            (then
              ;; Sudah memeriksa semua slot
              (br $search_done)
            )
          )
          
          ;; Check jika terlalu banyak probes
          (if (i32.ge_u (local.get $probes) (global.get $TABLE_SIZE))
            (then
              (br $search_done)
            )
          )
          
          (br $search_loop)
        )
        
        ;; Continue label
        (block $search_continue
          ;; Skip deleted, move ke next slot
          (local.set $slot_index
            (i32.rem_u
              (i32.add (local.get $slot_index) (i32.const 1))
              (global.get $TABLE_SIZE)
            )
          )
          
          ;; Check full circle
          (if (i32.eq (local.get $slot_index) (local.get $initial_slot))
            (then
              (br $search_done)
            )
          )
          
          (br $search_loop)
        )
      )
    )
    
    ;; Allocate result array (16 bytes = 4 x i32)
    (local.set $result_ptr (call $alloc (i32.const 16)))
    
    ;; Store results
    (i32.store (local.get $result_ptr) (local.get $found))           ;; [0] found flag
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 4)) 
      (local.get $current_status)
    )                                                                  ;; [1] status
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 8)) 
      (local.get $slot_index)
    )                                                                  ;; [2] final slot
    (i32.store 
      (i32.add (local.get $result_ptr) (i32.const 12)) 
      (local.get $probes)
    )                                                                  ;; [3] probe count
    
    ;; Return result pointer
    (local.get $result_ptr)
  )
  
  ;; Insert single entry (untuk dynamic insert)
  (func $insert_entry (param $ip i32) (param $status i32) (result i32)
    (local $hash_value i32)
    (local $slot_index i32)
    (local $probes i32)
    
    ;; Calculate hash
    (local.set $hash_value (call $fnv1a_hash (local.get $ip)))
    
    ;; Calculate initial slot
    (local.set $slot_index
      (i32.rem_u (local.get $hash_value) (global.get $TABLE_SIZE))
    )
    
    ;; Reset probes
    (local.set $probes (i32.const 0))
    
    ;; Linear probing untuk insert
    (block $insert_done
      (loop $insert_loop
        ;; Increment probes
        (local.set $probes (i32.add (local.get $probes) (i32.const 1)))
        
        ;; Check jika slot tersedia
        (if 
          (i32.or
            (i32.eq 
              (call $read_entry_hash (local.get $slot_index)) 
              (global.get $EMPTY_SLOT)
            )
            (i32.eq 
              (call $read_entry_hash (local.get $slot_index)) 
              (global.get $DELETED_SLOT)
            )
          )
          (then
            ;; Write entry
            (call $write_entry 
              (local.get $slot_index)
              (local.get $hash_value)
              (local.get $ip)
              (local.get $status)
            )
            
            ;; Update collision stats
            (if (i32.gt_u (local.get $probes) (i32.const 1))
              (then
                (global.set $collision_count 
                  (i32.add (global.get $collision_count) (i32.const 1))
                )
              )
            )
            
            ;; Increment entry count
            (global.set $entry_count 
              (i32.add (global.get $entry_count) (i32.const 1))
            )
            
            (br $insert_done)
          )
        )
        
        ;; Move ke next slot
        (local.set $slot_index
          (i32.rem_u
            (i32.add (local.get $slot_index) (i32.const 1))
            (global.get $TABLE_SIZE)
          )
        )
        
        ;; Check full
        (if (i32.ge_u (local.get $probes) (global.get $TABLE_SIZE))
          (then
            ;; Table full, return -1
            (return (i32.const -1))
          )
        )
        
        (br $insert_loop)
      )
    )
    
    ;; Return slot index
    (local.get $slot_index)
  )
  
  ;; Delete entry (lazy deletion dengan tombstone)
  (func $delete_entry (param $ip i32) (result i32)
    (local $hash_value i32)
    (local $slot_index i32)
    (local $initial_slot i32)
    (local $current_hash i32)
    (local $current_ip i32)
    (local $probes i32)
    
    ;; Calculate hash
    (local.set $hash_value (call $fnv1a_hash (local.get $ip)))
    
    ;; Calculate initial slot
    (local.set $slot_index
      (i32.rem_u (local.get $hash_value) (global.get $TABLE_SIZE))
    )
    (local.set $initial_slot (local.get $slot_index))
    
    ;; Reset probes
    (local.set $probes (i32.const 0))
    
    ;; Search untuk delete
    (block $delete_done
      (loop $delete_loop
        ;; Increment probes
        (local.set $probes (i32.add (local.get $probes) (i32.const 1)))
        
        ;; Read current hash
        (local.set $current_hash 
          (call $read_entry_hash (local.get $slot_index))
        )
        
        ;; Check empty
        (if (i32.eq (local.get $current_hash) (global.get $EMPTY_SLOT))
          (then
            ;; Not found
            (return (i32.const 0))
          )
        )
        
        ;; Skip deleted
        (if (i32.ne (local.get $current_hash) (global.get $DELETED_SLOT))
          (then
            ;; Read IP
            (local.set $current_ip
              (i32.load
                (i32.add
                  (i32.add 
                    (global.get $hash_table_base)
                    (call $get_entry_offset (local.get $slot_index))
                  )
                  (i32.const 4)
                )
              )
            )
            
            ;; Check jika match
            (if (i32.eq (local.get $current_ip) (local.get $ip))
              (then
                ;; Mark as deleted (tombstone)
                (call $write_entry 
                  (local.get $slot_index)
                  (global.get $DELETED_SLOT)  ;; Tombstone
                  (i32.const 0)
                  (i32.const 0)
                )
                
                ;; Decrement entry count
                (global.set $entry_count 
                  (i32.sub (global.get $entry_count) (i32.const 1))
                )
                
                ;; Return success
                (return (i32.const 1))
              )
            )
          )
        )
        
        ;; Move ke next slot
        (local.set $slot_index
          (i32.rem_u
            (i32.add (local.get $slot_index) (i32.const 1))
            (global.get $TABLE_SIZE)
          )
        )
        
        ;; Check full circle
        (if (i32.eq (local.get $slot_index) (local.get $initial_slot))
          (then
            (return (i32.const 0))
          )
        )
        
        (br $delete_loop)
      )
    )
    
    ;; Should not reach here
    (i32.const 0)
  )
  
  ;; Clear hash table
  (func $clear_hash_table
    (local $i i32)
    
    ;; Reset semua entries ke EMPTY
    (if (i32.ne (global.get $hash_table_base) (i32.const 0))
      (then
        (local.set $i (i32.const 0))
        (block $clear_done
          (loop $clear_loop
            ;; Clear entry
            (call $write_entry 
              (local.get $i)
              (global.get $EMPTY_SLOT)
              (i32.const 0)
              (i32.const 0)
            )
            
            ;; Increment
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            
            ;; Check done
            (br_if $clear_done 
              (i32.ge_u (local.get $i) (global.get $TABLE_SIZE))
            )
            (br $clear_loop)
          )
        )
      )
    )
    
    ;; Reset globals
    (global.set $heap_ptr (global.get $INITIAL_HEAP))
    (global.set $entry_count (i32.const 0))
    (global.set $collision_count (i32.const 0))
    (global.set $probe_count (i32.const 0))
    (global.set $hash_table_base (i32.const 0))
    
    ;; Update JavaScript
    (call $update_heap_ptr (global.get $heap_ptr))
  )
  
  ;; Get memory usage
  (func $get_memory_usage (result i32)
    (global.get $heap_ptr)
  )
  
  ;; Get collision count
  (func $get_collision_count (result i32)
    (global.get $collision_count)
  )
)
