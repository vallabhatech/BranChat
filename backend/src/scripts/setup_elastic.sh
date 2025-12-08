#!/bin/bash

# Elasticsearch Setup Script
# This script sets up Elasticsearch for the SubChat MVP application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}SubChat MVP - Elasticsearch Setup${NC}"
echo "=================================="

# Check if we're in development or production
if [ -f ".env" ]; then
    source .env
    echo -e "${GREEN}✓${NC} Found .env file"
else
    echo -e "${YELLOW}⚠${NC} No .env file found, using environment variables"
fi

# Check required environment variables
if [ -z "$ELASTIC_URL" ]; then
    echo -e "${RED}✗${NC} ELASTIC_URL environment variable is required"
    exit 1
fi

echo -e "${GREEN}✓${NC} Elasticsearch URL: $ELASTIC_URL"

# Detect environment
if [[ "$ELASTIC_URL" == *"localhost"* ]] || [[ "$ELASTIC_URL" == *"127.0.0.1"* ]]; then
    ENVIRONMENT="local"
    echo -e "${GREEN}✓${NC} Detected local development environment"
elif [[ "$ELASTIC_URL" == *"cloud.es.io"* ]]; then
    ENVIRONMENT="cloud"
    echo -e "${GREEN}✓${NC} Detected Elastic Cloud environment"
else
    ENVIRONMENT="custom"
    echo -e "${YELLOW}⚠${NC} Detected custom Elasticsearch environment"
fi

# Function to test Elasticsearch connection
test_connection() {
    echo "Testing Elasticsearch connection..."
    
    # Build curl command based on authentication method
    CURL_CMD="curl -s"
    
    if [ ! -z "$ELASTIC_API_KEY" ]; then
        CURL_CMD="$CURL_CMD -H 'Authorization: ApiKey $ELASTIC_API_KEY'"
        echo -e "${GREEN}✓${NC} Using API key authentication"
    elif [ ! -z "$ELASTIC_USERNAME" ] && [ ! -z "$ELASTIC_PASSWORD" ]; then
        CURL_CMD="$CURL_CMD -u $ELASTIC_USERNAME:$ELASTIC_PASSWORD"
        echo -e "${GREEN}✓${NC} Using username/password authentication"
    else
        echo -e "${YELLOW}⚠${NC} No authentication configured"
    fi
    
    # Test connection
    RESPONSE=$(eval "$CURL_CMD $ELASTIC_URL/_cluster/health" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Successfully connected to Elasticsearch"
        echo "Cluster status: $(echo $RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)"
        return 0
    else
        echo -e "${RED}✗${NC} Failed to connect to Elasticsearch"
        return 1
    fi
}

# Function to check Elasticsearch version and vector support
check_version() {
    echo "Checking Elasticsearch version..."
    
    CURL_CMD="curl -s"
    if [ ! -z "$ELASTIC_API_KEY" ]; then
        CURL_CMD="$CURL_CMD -H 'Authorization: ApiKey $ELASTIC_API_KEY'"
    elif [ ! -z "$ELASTIC_USERNAME" ] && [ ! -z "$ELASTIC_PASSWORD" ]; then
        CURL_CMD="$CURL_CMD -u $ELASTIC_USERNAME:$ELASTIC_PASSWORD"
    fi
    
    VERSION_RESPONSE=$(eval "$CURL_CMD $ELASTIC_URL/" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        VERSION=$(echo $VERSION_RESPONSE | grep -o '"number":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✓${NC} Elasticsearch version: $VERSION"
        
        # Check if version supports vectors (8.0+)
        MAJOR_VERSION=$(echo $VERSION | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -ge 8 ]; then
            echo -e "${GREEN}✓${NC} Vector search supported (version 8.0+)"
        else
            echo -e "${YELLOW}⚠${NC} Vector search not supported (requires version 8.0+)"
            echo "  Text search will be used as fallback"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Could not determine Elasticsearch version"
    fi
}

# Function to create index if it doesn't exist
create_index() {
    echo "Setting up subchat-memories index..."
    
    CURL_CMD="curl -s"
    if [ ! -z "$ELASTIC_API_KEY" ]; then
        CURL_CMD="$CURL_CMD -H 'Authorization: ApiKey $ELASTIC_API_KEY'"
    elif [ ! -z "$ELASTIC_USERNAME" ] && [ ! -z "$ELASTIC_PASSWORD" ]; then
        CURL_CMD="$CURL_CMD -u $ELASTIC_USERNAME:$ELASTIC_PASSWORD"
    fi
    
    # Check if index exists
    INDEX_EXISTS=$(eval "$CURL_CMD -o /dev/null -w '%{http_code}' $ELASTIC_URL/subchat-memories")
    
    if [ "$INDEX_EXISTS" = "200" ]; then
        echo -e "${GREEN}✓${NC} Index 'subchat-memories' already exists"
    else
        echo "Creating index 'subchat-memories'..."
        
        # The actual index creation will be handled by the application
        # This script just verifies the setup
        echo -e "${GREEN}✓${NC} Index will be created by the application on first run"
    fi
}

# Main execution
echo ""
echo "Step 1: Testing connection..."
if ! test_connection; then
    echo -e "${RED}Setup failed: Cannot connect to Elasticsearch${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Verify ELASTIC_URL is correct"
    echo "2. Check authentication credentials"
    echo "3. Ensure Elasticsearch is running"
    echo "4. Check network connectivity"
    exit 1
fi

echo ""
echo "Step 2: Checking version and capabilities..."
check_version

echo ""
echo "Step 3: Verifying index setup..."
create_index

echo ""
echo -e "${GREEN}✓ Elasticsearch setup completed successfully!${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "URL: $ELASTIC_URL"
echo ""
echo "The application will automatically:"
echo "- Create the 'subchat-memories' index on first run"
echo "- Detect vector support capabilities"
echo "- Configure appropriate mappings"
echo ""
echo "You can now start the application with: npm run dev"