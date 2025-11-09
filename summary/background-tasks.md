# Background Tasks

## Location
`events/system/backgroundTasks.js`

## Tasks

### 1. Reminder Checking (Every Minute)
- Checks for due reminders
- Sends reminder messages to users
- Removes completed reminders

### 2. Giveaway Checking (Every Minute)
- Checks for ended giveaways
- Selects winners
- Announces results
- Updates giveaway status

### 3. Sprint Management
- **On Startup**: Resumes active sprints
- **Auto-End**: Ends sprints when time expires
- **Reminders**: Sends reminders at 5min, 1min, 30sec marks

## Sprint Functions

```javascript
// Resume active sprints on bot startup
async resumeActiveSprints(client)

// End a sprint and announce results
async endSprint(client, sprintId)

// Send reminder to sprint participants
async sendSprintReminder(client, sprintId, timeLeft)
```

## Usage

Sprint commands import these functions:
```javascript
const { resumeActiveSprints, endSprint, sendSprintReminder } = 
  require('../../events/system/backgroundTasks');
```
