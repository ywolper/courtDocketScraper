/**
 * Scheduler Module
 * Schedules regular checks for court case updates
 */

const schedule = require('node-schedule');

/**
 * Schedules a task to run at regular intervals
 * @param {number} intervalHours - Hours between checks
 * @param {Function} taskFunction - Function to execute on schedule
 * @returns {Object} Job object with control methods
 */
function scheduleMonitoring(intervalHours, taskFunction) {
  // Convert hours to cron expression (runs every N hours)
  // For example: every 6 hours = 0 */6 * * *
  const cronExpression = `0 */${intervalHours} * * *`;
  
  console.log(`[${new Date().toISOString()}] Setting up scheduler...`);
  console.log(`Cron expression: ${cronExpression} (every ${intervalHours} hours)`);
  
  try {
    const job = schedule.scheduleJob(cronExpression, async () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[${new Date().toISOString()}] Scheduled check triggered`);
      console.log(`${'='.repeat(60)}\n`);
      
      try {
        await taskFunction();
      } catch (error) {
        console.error(`Error in scheduled task: ${error.message}`);
      }
    });
    
    console.log(`✓ Scheduler initialized successfully`);
    
    return {
      job: job,
      cancel: () => {
        if (job) {
          job.cancel();
          console.log('✓ Scheduler cancelled');
        }
      },
      nextInvocation: job.nextInvocation ? job.nextInvocation.toString() : 'Pending'
    };
    
  } catch (error) {
    console.error(`Failed to initialize scheduler: ${error.message}`);
    throw error;
  }
}

/**
 * Starts immediate monitoring (for first run and manual triggers)
 * @param {Function} taskFunction - Function to execute
 * @returns {Promise<void>}
 */
async function runImmediateCheck(taskFunction) {
  console.log(`[${new Date().toISOString()}] Starting immediate check...`);
  
  try {
    await taskFunction();
  } catch (error) {
    console.error(`Error in immediate check: ${error.message}`);
    throw error;
  }
}

module.exports = {
  scheduleMonitoring,
  runImmediateCheck
};
