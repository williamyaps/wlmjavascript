#include <jni.h>
#include <string>
#include <chrono>
#include <atomic>
#include <mutex>
#include <vector>
#include <unordered_map>
#include <android/log.h>

#define LOG_TAG "PacketInspector"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// WASM runtime headers (dari wasm3/wasm-micro-runtime)
#include "wasm3.h"
#include "m3_env.h"

// Global WASM instance
static M3Environment* env = nullptr;
static M3Runtime* runtime = nullptr;
static M3Module* module = nullptr;
static M3Function* inspectFunc = nullptr;

// Performance metrics
static std::atomic<uint64_t> totalPackets{0};
static std::atomic<uint64_t> trackerPackets{0};
static std::chrono::steady_clock::time_point lastTime;
static double avgLatency = 0.0;

// Initialize WASM engine
extern "C" JNIEXPORT jboolean JNICALL
Java_com_example_packetinspector_WasmEngine_initWasm(
    JNIEnv* env,
    jobject /* this */,
    jbyteArray wasmBytes) {
    
    try {
        // Get WASM bytes
        jsize len = env->GetArrayLength(wasmBytes);
        std::vector<uint8_t> wasmData(len);
        env->GetByteArrayRegion(wasmBytes, 0, len, 
                                reinterpret_cast<jbyte*>(wasmData.data()));
        
        // Initialize WASM environment
        m3_env = m3_NewEnvironment();
        if (!m3_env) {
            LOGE("Failed to create WASM environment");
            return JNI_FALSE;
        }
        
        runtime = m3_NewRuntime(m3_env, 64 * 1024, nullptr);
        if (!runtime) {
            LOGE("Failed to create WASM runtime");
            return JNI_FALSE;
        }
        
        // Parse WASM module
        M3Result result = m3_ParseModule(m3_env, &module, 
                                         wasmData.data(), wasmData.size());
        if (result) {
            LOGE("Failed to parse WASM module: %s", result);
            return JNI_FALSE;
        }
        
        // Load module
        result = m3_LoadModule(runtime, module);
        if (result) {
            LOGE("Failed to load WASM module: %s", result);
            return JNI_FALSE;
        }
        
        // Find exported functions
        result = m3_FindFunction(&inspectFunc, runtime, "inspect_packet_fast");
        if (result) {
            LOGE("Failed to find inspect function: %s", result);
            return JNI_FALSE;
        }
        
        // Initialize tracker database
        M3Function* initFunc;
        result = m3_FindFunction(&initFunc, runtime, "init_tracker_db");
        if (!result) {
            m3_CallV(initFunc);
        }
        
        lastTime = std::chrono::steady_clock::now();
        LOGI("WASM engine initialized successfully");
        return JNI_TRUE;
        
    } catch (const std::exception& e) {
        LOGE("Exception during WASM init: %s", e.what());
        return JNI_FALSE;
    }
}

// Fast packet inspection using WASM
extern "C" JNIEXPORT jint JNICALL
Java_com_example_packetinspector_WasmEngine_inspectPacket(
    JNIEnv* env,
    jobject /* this */,
    jbyteArray packetData) {
    
    if (!runtime || !inspectFunc) {
        return 0;
    }
    
    auto start = std::chrono::high_resolution_clock::now();
    
    try {
        // Get packet bytes
        jsize len = env->GetArrayLength(packetData);
        std::vector<uint8_t> data(len);
        env->GetByteArrayRegion(packetData, 0, len, 
                                reinterpret_cast<jbyte*>(data.data()));
        
        // Allocate memory in WASM
        M3Function* allocFunc;
        if (!m3_FindFunction(&allocFunc, runtime, "wasm_alloc")) {
            uint32_t ptr = 0;
            M3Result result = m3_CallV(allocFunc, len, &ptr);
            
            if (result) {
                LOGE("WASM alloc failed: %s", result);
                return 0;
            }
            
            // Copy data to WASM memory
            uint8_t* wasmMem = m3_GetMemory(runtime, ptr, len);
            if (wasmMem) {
                memcpy(wasmMem, data.data(), len);
            }
            
            // Call inspection function
            uint32_t result_flags = 0;
            result = m3_CallV(inspectFunc, ptr, len, &result_flags);
            
            if (result) {
                LOGE("WASM inspect failed: %s", result);
                return 0;
            }
            
            // Update metrics
            totalPackets++;
            if (result_flags != 0) {
                trackerPackets++;
            }
            
            auto end = std::chrono::high_resolution_clock::now();
            double latency = std::chrono::duration<double, std::micro>(end - start).count();
            avgLatency = (avgLatency * 0.95) + (latency * 0.05);  // Exponential moving average
            
            return result_flags;
        }
        
    } catch (const std::exception& e) {
        LOGE("Exception during packet inspection: %s", e.what());
    }
    
    return 0;
}

// Batch inspection untuk throughput maksimal
extern "C" JNIEXPORT jint JNICALL
Java_com_example_packetinspector_WasmEngine_inspectBatch(
    JNIEnv* env,
    jobject /* this */,
    jobjectArray packetArray,
    jintArray resultArray) {
    
    if (!runtime) {
        return 0;
    }
    
    auto start = std::chrono::high_resolution_clock::now();
    
    try {
        jsize count = env->GetArrayLength(packetArray);
        jint* results = env->GetIntArrayElements(resultArray, nullptr);
        
        int trackersFound = 0;
        
        for (jsize i = 0; i < count; i++) {
            jbyteArray packet = (jbyteArray)env->GetObjectArrayElement(packetArray, i);
            
            if (packet) {
                jsize len = env->GetArrayLength(packet);
                std::vector<uint8_t> data(len);
                env->GetByteArrayRegion(packet, 0, len, 
                                        reinterpret_cast<jbyte*>(data.data()));
                
                // Quick inline inspection
                uint32_t result = inspectPacketInternal(data.data(), len);
                
                if (result != 0) {
                    results[i] = result;
                    trackersFound++;
                } else {
                    results[i] = 0;
                }
            }
            
            env->DeleteLocalRef(packet);
        }
        
        env->ReleaseIntArrayElements(resultArray, results, 0);
        
        auto end = std::chrono::high_resolution_clock::now();
        double latency = std::chrono::duration<double, std::milli>(end - start).count();
        
        totalPackets += count;
        trackerPackets += trackersFound;
        
        LOGI("Batch: %d packets in %.2f ms (%.2f µs/packet)", 
             count, latency, (latency * 1000) / count);
        
        return trackersFound;
        
    } catch (const std::exception& e) {
        LOGE("Exception during batch inspection: %s", e.what());
        return 0;
    }
}

// Get performance metrics
extern "C" JNIEXPORT jdouble JNICALL
Java_com_example_packetinspector_WasmEngine_getAvgLatency(
    JNIEnv* /* env */,
    jobject /* this */) {
    return avgLatency;
}

// Native inline inspection (fallback tanpa WASM)
uint32_t inspectPacketInternal(const uint8_t* data, size_t len) {
    // Fast path: check first few bytes
    if (len < 16) {
        return 0;
    }
    
    // Simple pattern matching
    static const char* patterns[] = {
        "google", "analytics", "track", "pixel",
        "ad", "beacon", "collect", "metrics"
    };
    
    for (const char* pattern : patterns) {
        size_t patternLen = strlen(pattern);
        for (size_t i = 0; i < len - patternLen; i++) {
            if (memcmp(data + i, pattern, patternLen) == 0) {
                return 1;  // Tracker detected
            }
        }
    }
    
    return 0;
}
