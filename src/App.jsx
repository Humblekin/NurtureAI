import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import router from './router';
import './styles/global.css';

function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
