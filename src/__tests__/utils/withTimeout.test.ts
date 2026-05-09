import { withTimeout, TimeoutError } from '../../utils/withTimeout';

describe('withTimeout', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('resolves with the value if the promise completes before the timeout', async () => {
    const promise = Promise.resolve('done');
    await expect(withTimeout(promise, 1000)).resolves.toBe('done');
  });

  it('rejects with TimeoutError if the promise does not resolve in time', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 5000));
    const wrapped = withTimeout(slow, 1000, 'test op');

    jest.advanceTimersByTime(1500);

    await expect(wrapped).rejects.toBeInstanceOf(TimeoutError);
    await expect(wrapped).rejects.toThrow('test op');
  });

  it('propagates the original rejection if the promise fails before the timeout', async () => {
    const failing = Promise.reject(new Error('original'));
    await expect(withTimeout(failing, 1000)).rejects.toThrow('original');
  });
});
