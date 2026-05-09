import React from 'react';
import * as RN from 'react-native';
import { render } from '../../test-utils';
import {
  getDeviceType,
  isTablet,
  isPhone,
  getGridColumns,
  responsiveValue,
  scaleSize,
} from '../../utils/responsive';

// Bypass TypeScript error for Dimensions not being in the type definition of react-native 0.81+
const { Text } = RN;
const Dimensions = (RN as any).Dimensions;

describe('Responsive Utils', () => {
  const mockDimensions = (width: number, height: number) => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 1, fontScale: 1 });
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should identify phone devices correctly', () => {
    mockDimensions(375, 812); // iPhone X
    expect(getDeviceType()).toBe('phone');
    expect(isPhone()).toBe(true);
    expect(isTablet()).toBe(false);
    expect(getGridColumns()).toBe(1);
  });

  it('should identify tablet devices correctly', () => {
    mockDimensions(800, 1280); // Tablet portrait
    expect(getDeviceType()).toBe('tablet');
    expect(isPhone()).toBe(false);
    expect(isTablet()).toBe(true);
    expect(getGridColumns()).toBe(2);
  });

  it('should identify TV devices correctly', () => {
    mockDimensions(1920, 1080); // TV
    expect(getDeviceType()).toBe('tv');
    expect(getGridColumns()).toBe(2); // TV uses tablet layout
  });

  it('should scale sizes correctly', () => {
    mockDimensions(375, 812); // Phone
    expect(scaleSize(10)).toBe(10);

    mockDimensions(800, 1280); // Tablet
    expect(scaleSize(10)).toBe(13); // 10 * 1.3
  });

  it('should return correct responsive values', () => {
    const values = {
      phone: 10,
      tablet: 20,
      tv: 30,
    };

    mockDimensions(375, 812); // Phone
    expect(responsiveValue(values)).toBe(10);

    mockDimensions(800, 1280); // Tablet
    expect(responsiveValue(values)).toBe(20);

    mockDimensions(1920, 1080); // TV
    expect(responsiveValue(values)).toBe(30);
  });
});

describe('Responsive Component Integration', () => {
  const TestComponent = () => {
    const columns = getGridColumns();
    const deviceType = getDeviceType();
    return <Text testID="info">{`Columns: ${columns}, Type: ${deviceType}`}</Text>;
  };

  it('should adapt to tablet dimensions', () => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 1024, height: 768, scale: 1, fontScale: 1 });

    const { getByTestId } = render(<TestComponent />);

    expect(getByTestId('info').props.children).toContain('Columns: 2');
    expect(getByTestId('info').props.children).toContain('Type: tablet');
  });

  it('should adapt to phone dimensions', () => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 375, height: 812, scale: 1, fontScale: 1 });

    const { getByTestId } = render(<TestComponent />);

    expect(getByTestId('info').props.children).toContain('Columns: 1');
    expect(getByTestId('info').props.children).toContain('Type: phone');
  });
});
