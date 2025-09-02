# User-Facing Messages Integration Guide

## Overview

The system now includes comprehensive user-facing messages that inform users about API quota limits, temporary unavailability, and system health issues. These messages are streamed in real-time during job searches and provide actionable advice.

## Message Types

### 1. Warning Messages (Quota Limits)
**Trigger**: When APIs are exhausted due to quota limits
**Example**:
```json
{
  "type": "user_message",
  "messageType": "warning",
  "title": "JSearch Temporarily Unavailable",
  "message": "JSearch has reached its quota limit and is temporarily unavailable. Please try again later or consider upgrading your plan for more requests.",
  "apiName": "jsearch",
  "action": "try_again_later",
  "timestamp": "2025-09-02T17:44:11.560Z"
}
```

### 2. Info Messages (Limited Results)
**Trigger**: When APIs return limited results
**Example**:
```json
{
  "type": "user_message",
  "messageType": "info",
  "title": "Adzuna Limited Results",
  "message": "Adzuna is returning limited results. This may be due to high demand or temporary issues.",
  "apiName": "adzuna",
  "action": "continue_search",
  "timestamp": "2025-09-02T17:44:11.560Z"
}
```

### 3. System Health Messages
**Trigger**: When system health is below certain thresholds
**Example**:
```json
{
  "type": "user_message",
  "messageType": "warning",
  "title": "Limited Job Sources Available",
  "message": "Only 43% of job sources are currently available. Results may be limited. Please try again later for more comprehensive results.",
  "action": "try_again_later",
  "timestamp": "2025-09-02T17:44:11.560Z"
}
```

## Frontend Integration

### Server-Sent Events (SSE) Handling

The messages are streamed via Server-Sent Events during job searches. Here's how to handle them in your frontend:

```javascript
// Connect to the job search endpoint
const eventSource = new EventSource('/api/search-jobs-modular', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    analysis: resumeAnalysis,
    filters: userFilters
  })
});

// Listen for user messages
eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  if (data.type === 'user_message') {
    displayUserMessage(data);
  } else if (data.type === 'search_complete') {
    // Handle final results with user messages
    if (data.userMessages && data.userMessages.length > 0) {
      data.userMessages.forEach(message => {
        displayUserMessage(message);
      });
    }
  }
};

function displayUserMessage(message) {
  const messageContainer = document.getElementById('user-messages');
  
  const messageElement = document.createElement('div');
  messageElement.className = `message message-${message.messageType}`;
  
  const icon = message.messageType === 'warning' ? '⚠️' : 'ℹ️';
  const actionText = message.action === 'try_again_later' 
    ? 'Try again later for better results' 
    : 'Continue with current results';
  
  messageElement.innerHTML = `
    <div class="message-header">
      <span class="message-icon">${icon}</span>
      <span class="message-title">${message.title}</span>
    </div>
    <div class="message-body">
      <p>${message.message}</p>
      <p class="message-action">💡 ${actionText}</p>
    </div>
  `;
  
  messageContainer.appendChild(messageElement);
}
```

### CSS Styling

```css
.message {
  margin: 10px 0;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid;
}

.message-warning {
  background-color: #fff3cd;
  border-left-color: #ffc107;
  color: #856404;
}

.message-info {
  background-color: #d1ecf1;
  border-left-color: #17a2b8;
  color: #0c5460;
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.message-icon {
  font-size: 18px;
  margin-right: 8px;
}

.message-title {
  font-weight: bold;
  font-size: 16px;
}

.message-body p {
  margin: 5px 0;
}

.message-action {
  font-style: italic;
  font-size: 14px;
  margin-top: 8px;
}
```

## Message Scenarios

### Scenario 1: API Quota Exceeded
**When**: RapidAPI monthly quota is exceeded
**User Sees**: 
- ⚠️ **JSearch Temporarily Unavailable**
- JSearch has reached its quota limit and is temporarily unavailable. Please try again later or consider upgrading your plan for more requests.
- 💡 Try again later for better results

### Scenario 2: Multiple APIs Exhausted
**When**: Several APIs are exhausted
**User Sees**:
- ⚠️ **Limited Job Sources Available**
- Only 43% of job sources are currently available. Results may be limited. Please try again later for more comprehensive results.
- 💡 Try again later for better results

### Scenario 3: Some APIs Working
**When**: Some APIs are working, others have issues
**User Sees**:
- ℹ️ **Some Job Sources Unavailable**
- 71% of job sources are available. You're getting results from the working sources.
- 💡 Continue with current results

## API Status Endpoints

### Get Current API Status
```bash
GET /api-status
```

**Response**:
```json
{
  "systemHealth": {
    "healthyPercentage": 43,
    "exhaustedPercentage": 29,
    "suspiciousPercentage": 29
  },
  "exhaustedApis": ["jsearch", "jobs"],
  "suspiciousApis": {"adzuna": 1, "themuse": 1},
  "nextResetIn": 56
}
```

### Reset API Status
```bash
POST /reset-api-status
```

**Response**:
```json
{
  "message": "API status reset successfully"
}
```

## Best Practices

### 1. Message Display
- Show messages prominently but not intrusively
- Use appropriate icons and colors
- Group related messages together
- Allow users to dismiss messages

### 2. User Experience
- Always provide actionable advice
- Explain what's happening in user-friendly terms
- Offer alternatives when possible
- Set expectations about when to try again

### 3. Error Handling
- Gracefully handle network issues
- Provide fallback messages
- Log errors for debugging
- Don't overwhelm users with technical details

## Testing

The system has been tested with various scenarios:
- ✅ Quota exceeded messages
- ✅ Limited results messages
- ✅ System health warnings
- ✅ Real-time streaming
- ✅ Error case handling
- ✅ Multiple message types

## Monitoring

Monitor the following metrics:
- API health percentage
- Number of exhausted APIs
- User message frequency
- User retry behavior
- System recovery time

The user-facing message system ensures users are always informed about the status of job search APIs and provides clear guidance on what to do next.
