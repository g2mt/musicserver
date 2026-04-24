import path from 'path';

export const reactOptions: any = {
  babel: {
    plugins: ['babel-plugin-react-compiler'],
  },
};

export const resolveOptions = {
  alias: {
    'src': path.resolve(__dirname, './src'),
  },
};
