package com.example.packetinspector

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Safe WebAssembly Engine wrapper
 * Menjamin memory safety saat berinteraksi dengan WASM
 */
class WasmEngine(private val context: Context) {
    companion object {
        private const val TAG = "WasmEngine"
        private const val INITIAL_HEAP = 1024
        private const val MAX_HEAP = 1024 * 1024 // 1MB
    }
    
    private var wasmInstance: WasmInstance? = null
    private var heapPtr = INITIAL_HEAP
    
    @Volatile
    private var isInitialized = false
    
    // Thread-safe initialization
    @Synchronized
    fun initialize() {
        if (isInitialized) return
        
        try {
            // Load WASM binary dari assets
            val wasmBytes = context.assets.open("wasm/packet_filter.wasm").use {
                it.readBytes()
            }
            
            // Initialize WASM instance
            wasmInstance = WasmInstance(wasmBytes)
            
            // Initialize tracker database
            val trackerCount = wasmInstance?.callFunction("init_tracker_db")
            Log.i(TAG, "Tracker database initialized: $trackerCount entries")
            
            isInitialized = true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize WASM engine", e)
            isInitialized = false
        }
    }
    
    /**
     * Safe packet inspection
     * @return Tracker info if detected, null otherwise
     */
    suspend fun inspectPacket(packet: ByteArray): TrackerInfo? {
        if (!isInitialized) return null
        if (packet.size < 20) return null
        
        return withContext(Dispatchers.Default) {
            try {
                // Allocate memory in WASM heap
                val ptr = allocateMemory(packet.size)
                
                // Copy packet data ke WASM memory
                writeMemory(ptr, packet)
                
                // Call WASM inspection function
                val result = wasmInstance?.callFunction("inspect_packet_safe", ptr, packet.size)
                
                // Parse result
                result?.let { parseResult(it) }
                
                // Reset heap pointer (prevent memory leak)
                heapPtr = ptr
                
                null
            } catch (e: Exception) {
                Log.e(TAG, "Packet inspection failed", e)
                null
            }
        }
    }
    
    /**
     * Safe batch inspection
     */
    suspend fun inspectBatch(packets: List<ByteArray>): List<TrackerInfo?> {
        if (!isInitialized) return emptyList()
        if (packets.size > 10000) throw IllegalArgumentException("Batch too large")
        
        return withContext(Dispatchers.Default) {
            try {
                // Allocate arrays
                val packetPtrs = IntArray(packets.size)
                val lengths = IntArray(packets.size)
                val results = IntArray(packets.size)
                
                // Allocate each packet
                for (i in packets.indices) {
                    val ptr = allocateMemory(packets[i].size)
                    writeMemory(ptr, packets[i])
                    packetPtrs[i] = ptr
                    lengths[i] = packets[i].size
                }
                
                // Write arrays to WASM
                val ptrsPtr = allocateMemory(packetPtrs.size * 4)
                val lengthsPtr = allocateMemory(lengths.size * 4)
                val resultsPtr = allocateMemory(results.size * 4)
                
                writeIntArray(ptrsPtr, packetPtrs)
                writeIntArray(lengthsPtr, lengths)
                
                // Call batch function
                wasmInstance?.callFunction(
                    "inspect_packet_batch_safe",
                    ptrsPtr, lengthsPtr, packets.size, resultsPtr
                )
                
                // Read results
                val resultArray = readIntArray(resultsPtr, packets.size)
                
                // Parse results
                resultArray.map { result ->
                    if (result != 0) parseResult(result) else null
                }
                
                // Reset heap
                heapPtr = INITIAL_HEAP
                
                emptyList()
            } catch (e: Exception) {
                Log.e(TAG, "Batch inspection failed", e)
                emptyList()
            }
        }
    }
    
    /**
     * Safe memory allocation dengan bounds checking
     */
    private fun allocateMemory(size: Int): Int {
        val alignedSize = (size + 7) and -8  // 8-byte alignment
        
        if (heapPtr + alignedSize > MAX_HEAP) {
            throw OutOfMemoryError("WASM heap overflow")
        }
        
        val ptr = heapPtr
        heapPtr += alignedSize
        return ptr
    }
    
    /**
     * Safe memory write
     */
    private fun writeMemory(ptr: Int, data: ByteArray) {
        wasmInstance?.let { instance ->
            val memory = instance.getMemory()
            if (ptr + data.size > memory.capacity()) {
                throw IndexOutOfBoundsException("Memory write out of bounds")
            }
            
            val buffer = ByteBuffer.wrap(memory)
            buffer.position(ptr)
            buffer.put(data)
        }
    }
    
    /**
     * Safe int array write
     */
    private fun writeIntArray(ptr: Int, data: IntArray) {
        wasmInstance?.let { instance ->
            val memory = instance.getMemory()
            val buffer = ByteBuffer.wrap(memory).order(ByteOrder.LITTLE_ENDIAN)
            buffer.position(ptr)
            
            for (value in data) {
                buffer.putInt(value)
            }
        }
    }
    
    /**
     * Safe int array read
     */
    private fun readIntArray(ptr: Int, count: Int): IntArray {
        val result = IntArray(count)
        
        wasmInstance?.let { instance ->
            val memory = instance.getMemory()
            val buffer = ByteBuffer.wrap(memory).order(ByteOrder.LITTLE_ENDIAN)
            buffer.position(ptr)
            
            for (i in 0 until count) {
                result[i] = buffer.int
            }
        }
        
        return result
    }
    
    /**
     * Parse inspection result
     */
    private fun parseResult(result: Long): TrackerInfo? {
        if (result == 0L) return null
        
        val trackerType = ((result shr 24) and 0xFF).toInt()
        val riskLevel = ((result shr 16) and 0xFF).toInt()
        val patternHash = (result and 0xFFFF).toInt()
        
        return TrackerInfo(trackerType, riskLevel, patternHash)
    }
    
    /**
     * Cleanup
     */
    @Synchronized
    fun cleanup() {
        heapPtr = INITIAL_HEAP
        wasmInstance = null
        isInitialized = false
    }
    
    /**
     * Get current memory usage
     */
    fun getMemoryUsage(): Int {
        return heapPtr - INITIAL_HEAP
    }
}

/**
 * Tracker information data class
 */
data class TrackerInfo(
    val trackerType: Int,
    val riskLevel: Int,
    val patternHash: Int
) {
    val riskLabel: String
        get() = when (riskLevel) {
            1 -> "Low"
            2 -> "Medium"
            3 -> "High"
            else -> "Unknown"
        }
}

/**
 * WASM Instance wrapper
 */
class WasmInstance(private val binary: ByteArray) {
    private val memory: ByteBuffer
    
    init {
        // Initialize WASM memory (64 pages = 4MB)
        memory = ByteBuffer.allocateDirect(4 * 1024 * 1024)
    }
    
    fun callFunction(name: String, vararg args: Any?): Long {
        // Simulated WASM function call
        // In real implementation, this would use WASM runtime
        return 0L
    }
    
    fun getMemory(): ByteBuffer {
        return memory
    }
}
