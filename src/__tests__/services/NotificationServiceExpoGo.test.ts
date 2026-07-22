describe('NotificationService in Expo Go', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not load remote-push APIs during startup', async () => {
    jest.doMock('../../utils/env', () => ({
      isExpoGo: () => true,
    }));
    jest.doMock('expo-notifications', () => {
      throw new Error('Remote push APIs must not load in Expo Go');
    });

    let notificationService:
      | typeof import('../../services/utils/notificationService').default
      | undefined;

    expect(() => {
      jest.isolateModules(() => {
        notificationService = jest.requireActual<
          typeof import('../../services/utils/notificationService')
        >('../../services/utils/notificationService').default;
      });
    }).not.toThrow();

    await expect(notificationService?.initialize()).resolves.toBe(true);
  });
});
