# kued
Extensions for Kue (Daemonization, Checkpointing, etc.)

![Build Status](https://circleci.com/gh/YEDev/kued.svg?style=shield&circle-token=:circle-token)

## Workers

Kued simplifies worker creation by organizing Job handling around classes:

```javascript
const Worker = require('kued').Worker;

class MyWorker extends Worker {

  // This is where you can register handlers.
  init(){
    this.process('my-task', 'myTaskHandler');
    this.process('my-task-2', this.myTask2Handler.bind(this));
    // Retrieve up to 50 messages at a time (default is 1).
    this.process('my-task-3', 50, this.myTask3Handler.bind(this));
    this.process('my-task-4', (job, context, done) -> done());
  }

  myTaskHandler(job, context, done){
    done();
  }

  myTask2Handler(job, context, done){
    done();
  }

  myTask3Handler(job, context, done){
    done();
  }
}
```

The queue is available to `Worker`s, so the outcome of one job can be another:

```javascript
const Worker = require('kued').Worker;

class MyWorker extends Worker {

  // This is where you can register handlers.
  init(){
    this.process('my-task', 'myTaskHandler');
  }

  myTaskHandler(job, context, done){
    this.queue.create('new-task', { foo: 'bar' }).save(done);
  }
}
```

### Time-based Intervals.

Sometimes you just need tasks executed at a regular interval.  For this usecase, we have a special `CronWorker`:


```javascript
const CronWorker = require('kued').CronWorker;

class Synchronizer extends CronWorker {

  constructor(config, logger, _queue){
    const cron = { "cronTime": "10 * * * * *", "runOnInit": true };
    super(cron, config, logger, _queue);
  }

  tick(){
    this.queue.create('new-task', { foo: 'bar' }).save(done);
  }
}
```

### Checkpoints.

With distributed workers, sometimes it's important to not process a record for some reason, like if it's older than a last "modified" point.  For this use case, Kued provides a "checkpointing" feature that applies a predicate test before processing a record.

Checkpoints wrap a typical subscription (i.e. use of `Worker.process()`):

```javascript
const Worker = require('kued').Worker;
const moment = require('moment');

class CheckpointedWorker extends Worker {

  // This is where you can register handlers.
  init(){
    this.checkpoint()
        .topic('stock-quotes')
        .concurrency(1)
        .keyFactory((quote) => {
          // dynamically determining the checkpoint key
          // allows checkpoints to be scoped to practically
          // anything.
          return `quotes:${quote.symbol}`;
        })
        .iff((quote, checkpoint, callback) => {
          return moment(quote.datetime).valueOf() > moment(checkpoint.lastseen).valueOf();
        })
        .process('myTaskHandler');
  }

  myTaskHandler(job, context, done){
    const quote = job.data;
    this.queue.create('stock-update', quote).save((err) => {
      // Second argument is the new checkpoint value.
      done(err, { lastseen: quote.datetime });
    });
  }
}
```

### Bridges.

Another common requirement of a worker is to receive messages from sources other than Kue.  A bridge is a mechanism to take messages off of a provider (like IronMQ) and forward it to a `Worker`.

```javascript
const BridgeFactory = require('kued').BridgeFactory;
const bridgeFactory = new BridgeFactory(config, logger);

// Specific options for the Bridge
const opts = {};

// This is not implemented yet.
const bridge = bridgeFactory.create('imq:queue', 'kue:task-worker-topic', opts);
```

## TaskManager

TaskManager is simply a tiny wrapper around Kue used to build and submit Jobs.  It's more of a convenience mechanism for managing the Kue connection outside of using a worker.

```javascript
const moment = require('moment');
const TaskManager = require('kued').TaskManager;
const taskManager = new TaskManager(config, logger);


const stockQuote = { symbol: 'ABCD', value: 35.2, datetime: moment().toISOString() };

// Simplest form of enqueuing a task
taskManager.enqueue('stock-quotes', stockQuote,(err) => {
  if (err) console.error(err);
});

// Omit the Callback and get the Kue job (make further adjustments as necessary,
// but don't forget to call `save()` to submit the job.
taskManager.enqueue('stock-quotes', stockQuote).priority('high').attempts(2).save((err) => {
  if (err) console.error(err);
  // Close the connection when your done!
  taskManager.close();
});
```

## Daemonizing

Worker config file: `workers.json`

```json
{
  "providers": [
    {
      "provides": "kue",
      "connection": {
        "prefix": "myservice",
          "redis": {
          "port": 6379,
            "host": "localhost",
            "auth": "alright_alright_alright"
        }
      }
    },
    {
      "provides": "imq",
      "token": "abcde12345",
      "project_id": "asdfadfadsf"
    },
    {
      "provides": "checkpointer",
      "name": "redis-checkpointer",
      "require": "kued/lib/checkpointers/redis"
    }
  ],
  "workers": [
    {
      "name": "MyWorker",
      "require": "./lib/workers/myworker",
      "options": {
        "mongo": "mongodb://blah"
      }
    },
    {
      "name": "YourWorker",
      "require": "./lib/workers/yourworker",
      "options": {
        "db": "mysql://blah"
      }
    }
  ],
  "bridges": [
    {
      "name": "GoldenGate",
      "to": "imq:queue",
      "from": "kue:task-worker-topic",
      "options": {}
    }
  ],
  "workgroups": [
    {
      "workers": ["MyWorker", "YourWorker"],
      "instances": 3
    },
    {
      "workers": ["GoldenGate"],
      "instances": 1
    }
  ]
}
```

And to start that workers, just use the `workers.js` entrypoint:

```
# Your project
npm install
./node_modules/.bin/kued workers --config=workers.json
```

## Evergreen Integration

Evergreen is side project of ours for making Node configuration easier and more powerful.  We created a simple wrapper to allow a `Workgroup` to be spawned after importing an Evergreen compatible configuration file.

```
# Get the range of options by specifying the --help flag
everkued --help

# Example of spawning a Workgroup:
everkued --config config.json -workgroup ImageProcessor \
         --workers-path foo.bar.workers --modules trbl-evergreen-mongo
```

Keep in mind, this is used to spawn only one workgroup.


## Task Enqueuing from Cli

```
# Your project
npm install
./node_modules/.bin/kued task --config=tasks.json taskname --params
```
