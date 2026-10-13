#!/bin/bash
# Mobile App Production Build Script
# Usage: ./scripts/build-mobile.sh [staging|production] [version]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

echo -e "${GREEN}Building Den Den Mobile App for $ENVIRONMENT (version: $VERSION)${NC}"

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}Error: EAS CLI not installed. Run: npm install -g @expo/eas-cli${NC}"
    exit 1
fi

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Expo. Run: eas login${NC}"
    exit 1
fi

# Verify secrets for production
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "${YELLOW}Verifying production secrets...${NC}"
    
    # Check if credentials are configured
    if ! eas credentials --platform ios --non-interactive &> /dev/null; then
        echo -e "${RED}Error: iOS credentials not configured. Run: eas credentials --platform ios${NC}"
        exit 1
    fi
    
    if ! eas credentials --platform android --non-interactive &> /dev/null; then
        echo -e "${RED}Error: Android credentials not configured. Run: eas credentials --platform android${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Credentials verified${NC}"
fi

# Build the app
echo -e "${YELLOW}Building $ENVIRONMENT app...${NC}"

cd "$PROJECT_ROOT"

# Build for iOS
echo -e "${YELLOW}Building iOS...${NC}"
eas build --platform ios --profile "$ENVIRONMENT" --non-interactive

# Build for Android
echo -e "${YELLOW}Building Android...${NC}"
eas build --platform android --profile "$ENVIRONMENT" --non-interactive

echo -e "${GREEN}Build complete!${NC}"

# If production, ask about submitting to stores
if [[ "$ENVIRONMENT" == "production" ]]; then
    read -p "Submit to App Store and Play Store? (yes/no): " submit
    if [[ "$submit" == "yes" ]]; then
        echo -e "${YELLOW}Submitting to stores...${NC}"
        
        # Submit iOS
        echo -e "${YELLOW}Submitting iOS to App Store...${NC}"
        eas submit --platform ios --latest --profile production
        
        # Submit Android
        echo -e "${YELLOW}Submitting Android to Play Store...${NC}"
        eas submit --platform android --latest --profile production
        
        echo -e "${GREEN}Store submission complete!${NC}"
    fi
fi

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "${GREEN}Environment: $ENVIRONMENT${NC}"
echo -e "${GREEN}Check builds at: https://expo.dev/accounts/your-org/projects/den-den-app${NC}"