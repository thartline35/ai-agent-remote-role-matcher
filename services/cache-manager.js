// cache-manager.js - Centralized caching system for job search results

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Cache Manager for job search results and API responses
 * Provides in-memory and persistent caching with TTL support
 */
export class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.cacheDir = './cache';
        this.defaultTTL = 30 * 60 * 1000; // 30 minutes
        this.maxMemorySize = 100; // Maximum items in memory cache
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
        
        this.initializeCache();
        this.startCleanupTimer();
    }

    /**
     * Initialize cache directory
     */
    async initializeCache() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            console.log('📁 Cache directory initialized');
        } catch (error) {
            console.error('❌ Failed to initialize cache directory:', error.message);
        }
    }

    /**
     * Generate cache key from query and filters
     */
    generateCacheKey(query, filters = {}) {
        const keyData = {
            query: query.toLowerCase().trim(),
            filters: {
                experience: filters.experience || '',
                salary: filters.salary || '',
                timezone: filters.timezone || '',
                location: filters.location || '',
                remote: filters.remote || false
            }
        };
        
        const keyString = JSON.stringify(keyData);
        return crypto.createHash('md5').update(keyString).digest('hex');
    }

    /**
     * Get cached result
     */
    async get(key) {
        try {
            // Check memory cache first
            if (this.memoryCache.has(key)) {
                const cached = this.memoryCache.get(key);
                if (this.isValid(cached)) {
                    console.log(`💾 Cache hit (memory): ${key.substring(0, 8)}...`);
                    return cached.data;
                } else {
                    this.memoryCache.delete(key);
                }
            }

            // Check persistent cache
            const filePath = path.join(this.cacheDir, `${key}.json`);
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                const cached = JSON.parse(fileContent);
                
                if (this.isValid(cached)) {
                    // Move to memory cache for faster access
                    this.setMemoryCache(key, cached);
                    console.log(`💾 Cache hit (disk): ${key.substring(0, 8)}...`);
                    return cached.data;
                } else {
                    // Remove expired cache file
                    await fs.unlink(filePath);
                }
            } catch (error) {
                // File doesn't exist or is corrupted
            }

            return null;
        } catch (error) {
            console.error('❌ Cache get error:', error.message);
            return null;
        }
    }

    /**
     * Set cached result
     */
    async set(key, data, ttl = this.defaultTTL) {
        try {
            const cached = {
                data,
                timestamp: Date.now(),
                ttl,
                expiresAt: Date.now() + ttl
            };

            // Store in memory cache
            this.setMemoryCache(key, cached);

            // Store in persistent cache
            const filePath = path.join(this.cacheDir, `${key}.json`);
            await fs.writeFile(filePath, JSON.stringify(cached, null, 2));
            
            console.log(`💾 Cache set: ${key.substring(0, 8)}... (TTL: ${ttl / 1000 / 60}min)`);
        } catch (error) {
            console.error('❌ Cache set error:', error.message);
        }
    }

    /**
     * Set memory cache with size management
     */
    setMemoryCache(key, cached) {
        // Remove oldest entries if cache is full
        if (this.memoryCache.size >= this.maxMemorySize) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }
        
        this.memoryCache.set(key, cached);
    }

    /**
     * Check if cached item is valid
     */
    isValid(cached) {
        return cached && cached.expiresAt > Date.now();
    }

    /**
     * Clear cache by key
     */
    async clear(key) {
        try {
            // Remove from memory
            this.memoryCache.delete(key);
            
            // Remove from disk
            const filePath = path.join(this.cacheDir, `${key}.json`);
            try {
                await fs.unlink(filePath);
            } catch (error) {
                // File doesn't exist
            }
            
            console.log(`🗑️ Cache cleared: ${key.substring(0, 8)}...`);
        } catch (error) {
            console.error('❌ Cache clear error:', error.message);
        }
    }

    /**
     * Clear all cache
     */
    async clearAll() {
        try {
            // Clear memory cache
            this.memoryCache.clear();
            
            // Clear disk cache
            const files = await fs.readdir(this.cacheDir);
            const deletePromises = files
                .filter(file => file.endsWith('.json'))
                .map(file => fs.unlink(path.join(this.cacheDir, file)));
            
            await Promise.all(deletePromises);
            
            console.log('🗑️ All cache cleared');
        } catch (error) {
            console.error('❌ Cache clear all error:', error.message);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const memorySize = this.memoryCache.size;
        const memoryKeys = Array.from(this.memoryCache.keys());
        const validMemory = memoryKeys.filter(key => this.isValid(this.memoryCache.get(key))).length;
        
        return {
            memory: {
                total: memorySize,
                valid: validMemory,
                expired: memorySize - validMemory
            },
            directory: this.cacheDir,
            maxMemorySize: this.maxMemorySize,
            defaultTTL: this.defaultTTL
        };
    }

    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        setInterval(async () => {
            await this.cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Cleanup expired cache entries
     */
    async cleanup() {
        try {
            // Clean memory cache
            for (const [key, cached] of this.memoryCache.entries()) {
                if (!this.isValid(cached)) {
                    this.memoryCache.delete(key);
                }
            }

            // Clean disk cache
            const files = await fs.readdir(this.cacheDir);
            const cleanupPromises = files
                .filter(file => file.endsWith('.json'))
                .map(async (file) => {
                    try {
                        const filePath = path.join(this.cacheDir, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const cached = JSON.parse(content);
                        
                        if (!this.isValid(cached)) {
                            await fs.unlink(filePath);
                        }
                    } catch (error) {
                        // Remove corrupted files
                        await fs.unlink(path.join(this.cacheDir, file));
                    }
                });
            
            await Promise.all(cleanupPromises);
            
            console.log('🧹 Cache cleanup completed');
        } catch (error) {
            console.error('❌ Cache cleanup error:', error.message);
        }
    }

    /**
     * Cache job search results
     */
    async cacheJobSearch(query, filters, results) {
        const key = this.generateCacheKey(query, filters);
        const ttl = 15 * 60 * 1000; // 15 minutes for job search results
        await this.set(key, results, ttl);
        return key;
    }

    /**
     * Get cached job search results
     */
    async getCachedJobSearch(query, filters) {
        const key = this.generateCacheKey(query, filters);
        return await this.get(key);
    }
}

// Export singleton instance
export const cacheManager = new CacheManager();
