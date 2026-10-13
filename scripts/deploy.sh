#!/bin/bash
# Production Deployment Script for Den Den
# Usage: ./scripts/deploy.sh [staging|production] [version]

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

echo -e "${GREEN}Deploying Den Den to $ENVIRONMENT (version: $VERSION)${NC}"

# Function to check required tools
check_tools() {
    local tools=("kubectl" "docker" "helm")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            echo -e "${RED}Error: $tool is not installed${NC}"
            exit 1
        fi
    done
}

# Function to verify secrets
verify_secrets() {
    echo -e "${YELLOW}Verifying secrets...${NC}"
    
    # Check if secrets file exists
    if [[ ! -f "$PROJECT_ROOT/k8s/secrets.yaml" ]]; then
        echo -e "${RED}Error: k8s/secrets.yaml not found${NC}"
        exit 1
    fi
    
    # Check for placeholder values
    if grep -q "CHANGE_ME" "$PROJECT_ROOT/k8s/secrets.yaml"; then
        echo -e "${RED}Error: k8s/secrets.yaml contains placeholder values. Please update with real secrets.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Secrets verified${NC}"
}

# Function to build and push Docker images
build_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    cd "$PROJECT_ROOT/backend"
    
    # Build backend image
    docker build -t ghcr.io/your-org/den-den-backend:$VERSION -t ghcr.io/your-org/den-den-backend:latest .
    
    # Push to registry
    docker push ghcr.io/your-org/den-den-backend:$VERSION
    docker push ghcr.io/your-org/den-den-backend:latest
    
    cd "$PROJECT_ROOT"
}

# Function to deploy to Kubernetes
deploy_k8s() {
    echo -e "${YELLOW}Deploying to Kubernetes ($ENVIRONMENT)...${NC}"
    
    # Set kubectl context
    kubectl config use-context "$ENVIRONMENT"
    
    # Apply namespace
    kubectl apply -f "$PROJECT_ROOT/k8s/namespace.yaml"
    
    # Apply RBAC
    kubectl apply -f "$PROJECT_ROOT/k8s/rbac.yaml"
    
    # Apply ConfigMap
    kubectl apply -f "$PROJECT_ROOT/k8s/configmap.yaml"
    
    # Apply Secrets
    kubectl apply -f "$PROJECT_ROOT/k8s/secrets.yaml"
    
    # Apply Backend Deployment
    kubectl apply -f "$PROJECT_ROOT/k8s/backend-deployment.yaml"
    
    # Apply Ingress
    kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml"
    
    # Wait for rollout
    echo -e "${YELLOW}Waiting for rollout to complete...${NC}"
    kubectl rollout status deployment/den-den-backend -n den-den --timeout=300s
    
    # Verify deployment
    kubectl get pods -n den-den -l app=den-den-backend
}

# Function to run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    # Run migrations using a temporary pod
    kubectl run migration-job-$VERSION \
        --image=ghcr.io/your-org/den-den-backend:$VERSION \
        --restart=Never \
        --namespace=den-den \
        --command -- npm run db:migrate
    
    # Wait for completion
    kubectl wait --for=condition=complete job/migration-job-$VERSION -n den-den --timeout=120s
    
    # Cleanup
    kubectl delete job migration-job-$VERSION -n den-den
}

# Function to verify deployment
verify_deployment() {
    echo -e "${YELLOW}Verifying deployment...${NC}"
    
    # Check pod status
    kubectl get pods -n den-den -l app=den-den-backend -o wide
    
    # Check service
    kubectl get svc -n den-den den-den-backend
    
    # Check ingress
    kubectl get ingress -n den-den
    
    # Health check
    echo -e "${YELLOW}Running health checks...${NC}"
    sleep 10
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        HEALTH_URL="https://api.den-den.app/api/v1/health"
    else
        HEALTH_URL="https://staging-api.den-den.app/api/v1/health"
    fi
    
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        echo -e "${GREEN}Health check passed${NC}"
    else
        echo -e "${RED}Health check failed${NC}"
        exit 1
    fi
}

# Main deployment flow
main() {
    echo -e "${GREEN}=== Den Den Deployment Script ===${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "Version: $VERSION"
    echo ""
    
    check_tools
    verify_secrets
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            echo -e "${RED}Deployment cancelled${NC}"
            exit 1
        fi
    fi
    
    build_images
    deploy_k8s
    run_migrations
    verify_deployment
    
    echo -e "${GREEN}=== Deployment Complete ===${NC}"
    echo -e "${GREEN}Version $VERSION deployed to $ENVIRONMENT${NC}"
}

# Run main function
main "$@"