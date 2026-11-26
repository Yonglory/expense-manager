import { Image } from 'react-native';

export function Logo() {
  return (
    <Image source={require('../../assets/logo.png')} style={{ width: 200, height: 100 }} />
  );
}
