import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers/app-providers";
import { router } from "@/app/router/router";

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

export default App;
