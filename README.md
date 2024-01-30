# dapi

Simple library to create complex systems out of pure functions

## Installation

```bash
npm install -D @carpasse/dapi
```

## Usage

### Creating an _DapiWrapper_ instance

To create an `DapiWrapper` you need to create an [`DapiDefinition`](#dapidefinition) object and pass it to the [`createDapi`](#createdapi) factory function.

```Typescript
import {createDapi} from '@carpasse/dapi';

type Dependencies = {
  db: OracleClient,
  logger: Logger
}

type UserData = {
  name: string,
  email: string
}

// Pure function that takes its dependencies in the first argument aka DapiFn
const insertUser = async ({db, logger}: Dependencies, data: UserData) => {
  logger.info(`Inserting user`, {data});
  const entity = await db.insert('User', {
    ...data,
    id: randomUUID()
  });
  return entity;
}

export const createDapiUser = (dependencies: Dependencies) => createDapi({
  dependencies,
  fns: {
    // dictionary of pure functions that accept the above passed dependencies as their first argument
    create: insertUser,
    // ...
  },
  type: 'Entity'
  name: 'User'
}, EventEmitter);

export type DapiUser = ReturnType<typeof createUserApi>;
```

### Using the _DapiWrapper_ instance

```Typescript
import {createDapiUser} from './user';
import config from './config';
import {createDb} from './db';
import {createLogger} from './logger';

const user = createDapiUser({
  db: await createDb(config.db),
  logger: await createLogger(config.logger)
});

user.create({
  name: 'John Doe',
  email: 'johndoe@random.company.com'
});

// or

const {create: createUser} = createDapiUser({
  db: await createDb(config.db),
  logger: await createLogger(config.logger)
});

createUser({
  name: 'John Doe',
  email: 'johndoe@random.company.com'
});
```

## Why `dapi`?

For a system to be maintainable, it needs to be testable. If your system is hard to test, it is hard to maintain and evolve. The problem is that code is hard to test because it is usually designed to be tested. It is designed to be executed.

We are getting a bit philosophical here, but my above statements goes against the obvious fact that we write code to be executed and writing code with execution in mind should be the priority.

So, what is the simplest execution logic you can think of? A function. A function is a piece of code that takes some input and returns some output. It is the simplest form of execution logic. And for a function to be easily testable, it needs to be _pure_.

A **pure function** is a function that has no side effects and always returns the same output for the same input.

The problem with pure functions is that they usually have a set of dependencies they rely on to do their job. For example, they may need to access a database, or they may need to send an email. This is where the _dependency injection_ comes in handy.

**Dependency injection** is a technique whereby you split the responsibility of creating the dependencies from the responsibility of using them. By doing so, you can easily change them as your understanding of the system evolves. It also make the code easier to test because you can easily mock the dependencies.

## Proposal

Lets create systems that are composed of _pure functions_ that accept as their first argument all the dependencies they needs to do their job. This way, we can easily mock the dependencies when we test them.

From now on, we will call these functions **DapiFn**s.

### Example

```Typescript
import {randomUUID} from 'crypto';

export type Dependencies = {
  db: OracleClient,
  logger: Logger
}

export type UserData = {
  name: string,
  email: string
}

// Pure function that takes its dependencies in the first argument i.e. a DapiFn
export const createUser = async ({db, logger}: Dependencies, data: UserData) => {
  logger.info(`Creating user`, {data});
  const entity = await db.insert('User', {
    ...data,
    id: randomUUID()
  });
  return entity;
}
```

The problem with this approach is that it is very verbose. You need to pass the dependencies to every function you call. `createUser` function is going to be called by another function that will also needs other dependencies. This means that you need to pass the dependencies to the caller and the caller needs to pass the dependencies to the callee.

This is not ideal. The caller should not know about the dependencies of the callee. It should only know about the dependencies it needs to do its job. It also makes the code harder to test because you need to mock the dependencies of the caller and the callee.

```Typescript
import {
  createUser,
  type Dependencies as UserDependencies,
  type UserData
} from './createUser';

export const createCustomer = async (
  {db, logger, mqBroker}: {mqBroker: RabbitMQ} & UserDependencies,
  data: UserData) => {
  logger.info(`Creating customer`, {data});

  const newUser = await createUser({db, logger, mqBroker}, 'customer', data);

  mqBroker.publish('customer.created', {data: newUser});
}
```

Ideally you should pass a `createUser` fn with its dependencies already set to the `createCustomer` fn. This way, the `createCustomer` fn does not need to know about the dependencies of the `createPerson` fn. It only needs to know about the dependencies it needs to do its job.

```Typescript
import {createDapi, DapiFn} from '@carpasse/dapi';
import type {DapiUser, UserData} from './user';
import type {Logger} from './logger';
import type {RabbitMQ} from './mqBroker';

export type CustomerDeps = {
  user: DapiUser,
  logger: Logger,
  mqBroker: RabbitMQ
}

export const createCustomer= async ({user: {create}, logger}:  CustomerDeps, data: UserData) => {
  logger.info(`Creating customer`, {data});

  const newUser = await create('customer', data);

  mqBroker.publish('customer.created', {data: newUser});
};

export const createDapiCustomer = (dependencies: CustomerDeps) => createDapi({
  dependencies,
  fns: {
    create: createCustomer
  },
  type: 'Entity'
  name: 'Customer'
}, EventEmitter);
```

This is where the _dapi_ package comes in handy. The _dapi_ package is a library that allows you to [_loosely bind the dependencies_](#what-does-loosely-bound-mean) to the functions by creating an DapiWrapper around a group of functions that share the same dependencies (DapiFns). This way, you can easily pass the DapiWrapper instance as a dependency and the caller does not need to know about the dependencies of the callee.

#### What does _"loosely bind the dependencies"_ mean?

It means that the dependencies are not bound to the functions. The dapi wrapper will pass them to the function on execution. By doing so you are able to modify dependencies on runtime. Or decorate the dapi fns or add hooks to them.

Following on the previous example, we could do:

```Typescript
import {createLogger} from './logger';
import {createDapiUser} from './user';
import {createDapiCustomer} from './customer';

import {profile} from './profiler';


const start = async (config: Config) => {
  const logger = createLogger(config.logger);
  const {mqBroker, db} = createServiceClients(config);
  const user = createDapiUser({db, logger});
  const customer = createDapiCustomer({user, logger, mqBroker});

  config.on('db.config.update', async (dbConfig) => {
    const newDb = await createDb(dbConfig);

    await db.close();

    user.updateDependencies({db}); // From this point on all the user Dapi fns will receive the new db client on their first argument
  });

  if(config.profile.customer) {
    customer.decorate('createCustomer', (createCustomer, deps, ...args) => {
      return profile(deps.logger, createCustomer(deps, ...args));
    });
  }

  // you could also add hooks to the DapiFns
  customer.addHook('preCreateCustomer', (createCustomer, deps, ...args) => {
    deps.logger.info(`Create customer start` data);
  });

  customer.addHook('preCreateCustomer', (createCustomer, deps, ...args) => {
    deps.logger.info(`Create customer end` data);
  });


  // ... logic to start the server
}
```

## API

### DapiDefinition

Represents an [`DapiWrapper`](#dapiwrapper) definition with dependencies and fns.

#### Generic types

- `DEPENDENCIES` - The type of dependencies required by the `DAPI` functions dictionary.
- `DAPI` - A dictionary of pure functions the DapiWrapper will be composed of. All functions must accepts as their first argument a `DEPENDENCIES` type obj.

#### Syntax

```Typescript
  /**
   * Represents an `DapiWrapper` definition with dependencies and commands.
   * @template DEPENDENCIES - The type of dependencies required by the DapiFns.
   * @template DAPI - The pure functions the `Dapiwrapper` will be composed of.
   */
  interface interface DapiDefinition<DEPENDENCIES, DAPI extends DapiFns<DEPENDENCIES>> {
    dependencies: DEPENDENCIES;
    fns: DAPI;
    type: string;
    name?: string;
  }
```

#### Properties

- `dependencies` - The dependencies required by the `DapiFns`.
- `fns` - The pure functions the DAPI wrapper will be composed of.
- `type` - The type of the `DapiWrapper`.
- `name` - The name of the `DapiWrapper`.

### DapiMixin

[Mixin](https://justinfagnani.com/2015/12/21/real-mixins-with-javascript-classes/) fn that creates a [`DapiWrapper`]() class that extends the passed SuperClass class and wraps the passed DapiFns dictionary.

#### Syntax

```Typescript
DapiMixin<T extends DapiDefinition>
  (definition: T, SuperClass?: SuperClass): DapiWrapper<T>
```

#### Parameters

- `definition` - An [`DapiDefinition`](#dapidefinition) object
- [`SuperClass`] - An optional SuperClass class the returned [`DapiWrapper`](#dapiwrapper) class will extend from.

#### Returns

- A [`DapiWrapper`](#dapiwrapper) class.

### `createDapi`

Factory function that creates an DapiWrapper instance of the passed the `DapiFns`. it accepts a [`DapiDefinition`](#dapidefinition) object and an optional SuperClass class.

#### Syntax

```Typescript
createDapi<T extends DapiDefinition>
  (definition: T, SuperClass?: SuperClass): DapiWrapper<T>
```

#### Parameters

- `definition` - An [`DapiDefinition`](#dapidefinition) object
- [`SuperClass`] - An optional SuperClass class the returned [`DapiWrapper`](#dapiwrapper) class will extend from.

#### Returns

- A [`DapiWrapper`](#dapiwrapper) class instance.

#### Throws

- `TypeError` - If the definition is not an object
- `TypeError` - If the definition has no `dependencies` property
- `TypeError` - If the definition has no `fns` property
- `TypeError` - If the definition has no `type` property

### `DapiWrapper`

Inner class created by [`createDapi`](#createdapi) factory that wraps the [`DapiDefinition.fns`](#dapidefinition) fns and injects them the passed `DapiDefinition.dependencies` at runtime. It also provides methods to modify the dependencies and to hook and decorate the dapi fns.

Every instance of the DapiWrapper class creates a Facade of the [`DapiDefinition.fns`](#dapidefinition) fns. This means that every instance of the `DapiWrapper` class will have the same methods as the [`DapiDefinition.fns`](#dapidefinition) functions dictionary. The only difference is that the instance methods will omit the first argument of the [`DapiDefinition.fns`](#dapidefinition). This is because the DapiWrapper class injects the dependencies at runtime.

The class also allows to decorate the Dapi functions with decorators and hooks.

#### Generic types

- `DEPENDENCIES` - The type of dependencies required by the `DAPI` fns dictionary.
- `DAPI` - A dictionary of pure functions the `DapiWrapper` will be composed of. All functions must accepts as their first argument a `DEPENDENCIES` type obj.
- `T` - The constructor type of the class being enhanced.

#### Properties

- `type` _Readonly_ - Same as the `DapiDefinition.type` property.
- `name` _Readonly_ - Same as the `DapiDefinition.name` property.

#### Methods

##### `getDependencies`

Dependencies getter.

**Syntax**:

```Typescript
getDependencies(): DEPENDENCIES
```

##### `setDependencies`

Dependencies setter.

**Syntax**:

```Typescript
setDependencies(newDeps: DEPENDENCIES): void
```

**Parameters**:

- `newDeps` - The new dependencies to be set.

**Throws**:

- `TypeError` - If the new dependencies are not defined.

##### `updateDependencies`

Partially updates the dependencies of the `DapiWrapper`` instance.

**Syntax**:

```Typescript
updateDependencies(newDeps: Partial<DEPENDENCIES>): void
```

**Parameters**:

- `newDeps` - A partial of the new dependencies to be updated.

**Throws**:

- `TypeError` - If the new dependencies are not defined.

##### `toJSON`

Returns a JSON representation of the `DapiWrapper` instance.

**Syntax**:

```Typescript
  toJSON(...args: ParamsExtract<JSON['stringify'], [Parameters<JSON['stringify']>[0]]>)
```

**Parameters**:

- `replacer` - An array of strings and numbers that acts as an approved list for selecting the object properties that will be stringified.
- `space` - Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.

##### `toString`

Returns the `DapiWrapper` definition stringified for reading.

**Syntax**:

```Typescript
  toString(): string
```

##### `addDecorator`

Adds a decorator to a `DapiFn` of the `DapiWrapper` instance.

**Syntax**:

```Typescript
  addDecorator<KEY extends keyof DAPI>
    (key: KEY, decorator: DecoratorFn<DAPI[KEY], DapiWrapper>): () => void
```

**Parameters**:

- `key` - The key of the `DapiFn` function to decorate. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `decorator` - The decorator function to be added to the method. Each decorator must accept the following arguments
  - `fn` - The function to be decorated.
  - `deps` - The dependencies of the [`DapiDefinition.fns`](#dapidefinition).
  - `args` - The arguments passed to the method.

**Returns**:

- Function to remove the decorator that accepts no arguments.

**Throws**:

- `TypeError` - If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the [`DapiDefinition.fns`](#dapidefinition) dictionary.

**Example**

```Typescript
import {createDapi} from '@carpasse/dapi';
import {profile} from './profiler';
import {createPerson} from './person';

const instance = createDapi({
  dependencies: {db, logger},
  fns: {
    createPerson
  },
  type: 'Entity'
  name: 'Person'
});

instance.addDecorator('createPerson', (createPerson, deps, ...args) => {
  return profile(deps.logger, createPerson(deps, ...args));
});
```

Please note that the decorator function must call the decorated DapiDefinition fn and return the result of its call.

##### `removeDecorator`

Removes a decorator from the `DapiWrapper` instance.

**Syntax**:

```Typescript
  removeDecorator<KEY extends keyof DAPI>
    (key: KEY, decorator: DecoratorFn<DAPI[KEY], DApiWrapper>)
```

**Parameters**:

- `key` - The name of the decorated method. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `decorator` - The decorator function to be removed from the method.

##### `addHook`

Adds a hook to a `DapiFn` of the `DapiWrapper` instance. Hooks are functions that are called before (`hookType` = `'pre'`) or after (`hookType` = `'post'`) the `DapiFn` is called.

**Syntax**:

```Typescript
  addHook<KEY extends keyof API>(
      hookType: 'pre' | 'post',
      key: KEY,
      hook: HookFn<API[KEY], ApiWrapper>
    ): () => void
```

**Parameters**:

- `hookType` - The type of hook to be added. Can be either `pre` or `post`.
- `key` - The name of the method to be hooked. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `hook` - The hook function to be added to the method. Each hook must accept the following arguments
  - `fn` - The function to be hooked.
  - `deps` - The dependencies of the [`DapiDefinition.fns`](#dapidefinition).
  - `args` - The arguments passed to the method.

**Returns**

- Function to remove the hook that accepts no arguments.

**Throws**:

- `TypeError` - If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the [`DapiDefinition.fns`](#dapidefinition) dictionary.

**Example**

```Typescript
const instance = createDapi({
  dependencies: {db, logger},
  fns: {
    createPerson
  },
  type: 'Entity'
  name: 'Person'
});

instance.addHook('pre', 'createPerson', (createPerson, deps, ...args) => {
  deps.logger.info(`Create person start` data);
});

instance.addHook('post', 'createPerson', (createPerson, deps, ...args) => {
  deps.logger.info(`Create person end` data);
});
```

##### `removeHook`

Removes a decorator from the `DapiWrapper` instance.

**Syntax**

```Typescript
  removeHook<KEY extends keyof DAPI>(
      hookType: 'pre' | 'post',
      key: KEY,
      hook: HookFn<DAPI[KEY], DapiWrapper>
    ): void
```

**Parameters**

- `hookType` - The type of hook to be removed. Can be either `pre` or `post`.
- `key` - The name of the method to be unhooked. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `hook` - The hook function to be removed from the method.

##### `addPreHook`

Adds a pre hook to `DapiDefinition['api']` function calls. Pre hooks are functions that are called before the decorated function is called.

**Syntax**:

```Typescript
  addPreHook<KEY extends keyof DAPI>(
      key: KEY,
      hook: HookFn<DAPI[KEY], DapiWrapper>
    ): () => void
```

**Parameters**:

- `key` - The name of the method to be hooked. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `hook` - The hook function to be added to the method. Each hook must accept the following arguments
  - `fn` - The function to be hooked.
  - `deps` - The dependencies of the [`DapiDefinition.fns`](#dapidefinition).
  - `args` - The arguments passed to the method.

**Returns**

- Function to remove the hook that accepts no arguments.

**Throws**:

- `TypeError` - If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the [`DapiDefinition.fns`](#dapidefinition) dictionary.

##### `removePreHook`

Removes a pre hook from a _Facade_ method of the `DapiWrapper` instance.

**Syntax**

```Typescript
  removePreHook<KEY extends keyof DAPI>(
      key: KEY,
      hook: HookFn<DAPI[KEY], DapiWrapper>
    ): void
```

**Parameters**

- `key` - The name of the method to be unhooked. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `hook` - The hook function to be removed from the method.

##### `addPostHook`

Adds a post hook to `DapiDefinition['api']` function calls. Post hooks are functions that are called after the decorated function is called.

**Syntax**

```Typescript
  addPostHook<KEY extends keyof API>(
      key: KEY,
      hook: HookFn<API[KEY], ApiWrapper>
    ): () => void
```

**Parameters**:

- `key` - The name of the method to be hooked. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `hook` - The hook function to be added to the method. Each hook must accept the following arguments
  - `fn` - The function to be hooked.
  - `deps` - The dependencies of the [`DapiDefinition.fns`](#dapidefinition).
  - `args` - The arguments passed to the method.

**Returns**

- Function to remove the hook that accepts no arguments.

**Throws**:

- `TypeError` - If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the [`DapiDefinition.fns`](#dapidefinition) dictionary.

##### `removePostHook`

Removes a post hook from the `DapiWrapper` instance.

**Syntax**

```Typescript
  removePostHook<KEY extends keyof DAPI>(
      key: KEY,
      hook: HookFn<DAPI[KEY], DapiWrapper>
    ): void
```

**Parameters**

- `key` - The name of the method to be unhooked. Must be a key of the [`DapiDefinition.fns`](#dapidefinition) fns dictionary.
- `hook` - The hook function to be removed from the method.

#### FACADE methods

Every instance of the DapiWrapper class creates a Facade of the [`DapiDefinition.fns`](#dapidefinition) fns. This means that every instance of the class will have the same methods as the [`DapiDefinition.fns`](#dapidefinition) functions dictionary. The only difference is that the instance methods will omit the first argument of the [`DapiDefinition.fns`](#dapidefinition). This is because the
DapiWrapper class injects the dependencies at runtime.

**Example**

```Typescript
const instance = createDapi({
  dependencies: {db, logger},
  fns: {
    createPerson
  },
  type: 'Entity'
  name: 'Person'
});

instance.createPerson({name: 'John Doe'});
```
