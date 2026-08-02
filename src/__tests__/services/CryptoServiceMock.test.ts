import CryptoServiceMock from '../../services/crypto/cryptoServiceMock';
import { randomInt } from '../../utils/cryptoRandom';

jest.mock('../../utils/cryptoRandom', () => ({
  randomInt: jest.fn(),
}));

describe('CryptoServiceMock', () => {
  it('does not mistake digits for special characters when enforcing character sets', () => {
    (randomInt as jest.Mock).mockReturnValue(0);

    const generated = CryptoServiceMock.generateSecurePassword(8, false, false, true, true);

    expect(generated).toMatch(/[0-9]/);
    expect([...generated].some((char) => '!@#$%^&*()_+~`|}{[]:;?><,./-='.includes(char))).toBe(
      true,
    );
  });
});
