import { describe, expect, it } from "vitest";
import { searchChannels } from "./youtube";

describe("YouTube API Integration", () => {
  it("should successfully search for channels with valid API key", async () => {
    // Test with a well-known channel search
    const results = await searchChannels("TED", 1);
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    // Verify result structure
    const firstResult = results[0];
    expect(firstResult).toHaveProperty("id");
    expect(firstResult).toHaveProperty("title");
    expect(firstResult).toHaveProperty("description");
    expect(firstResult).toHaveProperty("thumbnail");
    
    // Verify the result contains actual data
    expect(typeof firstResult.id).toBe("string");
    expect(firstResult.id.length).toBeGreaterThan(0);
    expect(typeof firstResult.title).toBe("string");
    expect(firstResult.title.length).toBeGreaterThan(0);
  }, 10000); // 10 second timeout for API call
});
