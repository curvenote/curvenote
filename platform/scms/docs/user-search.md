# User Search Implementation

## Overview

The user search functionality uses a **hybrid database + Fuse.js approach** for optimal performance and fuzzy matching capabilities.

## How It Works

### Two-Stage Search Process

1. **Database Pre-filtering** (Performance)
   - Uses PostgreSQL `ILIKE` queries for fast initial filtering
   - Leverages existing database indexes
   - Searches across `display_name`, `username`, and `email` fields
   - Gets 3x the requested limit as candidates

2. **Fuse.js Refinement** (Fuzzy Matching)
   - Applies sophisticated fuzzy matching algorithms
   - Handles typos and variations (e.g., "jon" matches "john")
   - Ranks results by relevance score
   - Returns top results up to the requested limit

## Features

### Search Capabilities
- **Partial matching**: Finds results with incomplete queries
- **Fuzzy matching**: Handles typos and variations  
- **Multi-field search**: Searches display_name, username, and email
- **Relevance ranking**: Results sorted by Fuse.js relevance score
- **Case insensitive**: Handles different capitalizations

### Performance Benefits
- **Fast initial filtering**: Database does heavy lifting with indexes
- **Manageable dataset**: Fuse.js only processes pre-filtered candidates
- **Scalable**: Performance doesn't degrade significantly with user count

### Configuration

**Search Parameters:**
- `query`: Search term (minimum 3 characters)
- `limit`: Maximum results (default: 20)

**Fuse.js Settings:**
- `threshold: 0.4`: Moderately permissive for good partial matching
- Field weights: `display_name` (40%), `username` (30%), `email` (30%)
- `minMatchCharLength: 2`: Allows shorter partial matches

## Usage Example

```typescript
// Search for users matching "joh"
const results = await dbSearchUsers("joh", 10);

// Results might include:
// - "John Doe" (exact partial match)
// - "Johann Smith" (fuzzy match)  
// - "Johnson" (contains match)
```

## Architecture Benefits

✅ **No external dependencies**: Pure JavaScript + standard database queries  
✅ **Portable**: Works with any PostgreSQL setup  
✅ **Reliable**: No complex extensions or configurations required  
✅ **Maintainable**: Standard Prisma queries + well-documented Fuse.js  
✅ **Fast**: Database pre-filtering keeps Fuse.js dataset manageable
