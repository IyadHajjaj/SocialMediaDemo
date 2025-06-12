import React from 'react';
import { render } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import ProfileAvatar from '../../components/ProfileAvatar';

describe('ProfileAvatar', () => {
  it('renders correctly with a valid image URI', () => {
    const validUri = 'https://example.com/avatar.jpg';
    const { getByTestId, queryByTestId } = render(
      <ProfileAvatar size={90} uri={validUri} name="Test User" />
    );

    expect(getByTestId('avatar-image')).toBeTruthy();
    expect(queryByTestId('avatar-fallback-icon')).toBeNull();
  });

  it('renders fallback icon when URI is invalid', () => {
    const { getByTestId, queryByTestId } = render(
      <ProfileAvatar size={90} uri={null} name="Test User" />
    );

    expect(getByTestId('avatar-fallback-icon')).toBeTruthy();
    expect(queryByTestId('avatar-image')).toBeNull();
  });

  it('renders fallback icon when URI is empty string', () => {
    const { getByTestId, queryByTestId } = render(
      <ProfileAvatar size={90} uri="" name="Test User" />
    );

    expect(getByTestId('avatar-fallback-icon')).toBeTruthy();
    expect(queryByTestId('avatar-image')).toBeNull();
  });

  it('renders fallback icon when image fails to load', () => {
    const invalidUri = 'https://example.com/broken-image.jpg';
    const { getByTestId, queryByTestId, rerender } = render(
      <ProfileAvatar size={90} uri={invalidUri} name="Test User" />
    );

    // Initially it will try to render the image
    expect(getByTestId('avatar-image')).toBeTruthy();
    
    // Simulate an image load error
    act(() => {
      getByTestId('avatar-image').props.onError();
    });
    
    // No need to manually rerender as act will flush effects
    
    // Now it should render the fallback icon
    expect(getByTestId('avatar-fallback-icon')).toBeTruthy();
    expect(queryByTestId('avatar-image')).toBeNull();
  });

  it('applies custom size correctly', () => {
    const customSize = 120;
    const { getByTestId } = render(
      <ProfileAvatar size={customSize} uri={null} name="Test User" />
    );

    const icon = getByTestId('avatar-fallback-icon');
    expect(icon.props.size).toBeCloseTo(customSize * 0.55);
  });
}); 