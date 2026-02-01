import { useState, useEffect } from "react";
import { BeerList } from "./components/BeerList";
import { BeerForm } from "./components/BeerForm";
import { MenuScanner } from "./components/MenuScanner";
import { LoginForm } from "./components/LoginForm";
import { type Beer } from "./types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beer as BeerIcon, Camera, Plus, LogOut } from "lucide-react";

function App() {
  const [authToken, setAuthToken] = useState<string | null>(
    localStorage.getItem("authToken"),
  );
  const [selectedBeer, setSelectedBeer] = useState<Beer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBeer, setEditingBeer] = useState<Beer | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogin = (token: string) => {
    setAuthToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthToken(null);
  };

  // Check if auth is required (if token is needed but not present)
  useEffect(() => {
    // This will be checked when API calls fail
  }, []);

  if (!authToken) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const handleAddBeer = () => {
    setEditingBeer(undefined);
    setShowForm(true);
  };

  const handleEditBeer = (beer: Beer) => {
    setEditingBeer(beer);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BeerIcon className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Beer Ratings</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleAddBeer} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Beer
              </Button>
              <Button onClick={handleLogout} size="sm" variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="collection" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="collection" className="gap-2">
              <BeerIcon className="h-4 w-4" />
              Collection
            </TabsTrigger>
            <TabsTrigger value="scanner" className="gap-2">
              <Camera className="h-4 w-4" />
              Menu Scanner
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collection" className="space-y-6">
            <BeerList
              key={refreshKey}
              onSelectBeer={handleEditBeer}
              onAddBeer={handleAddBeer}
            />
          </TabsContent>

          <TabsContent value="scanner" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <MenuScanner
                onBeerSelect={(beerId) => {
                  // TODO: Implement beer detail view
                  console.log("Selected beer:", beerId);
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <BeerForm
        beer={editingBeer}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

export default App;
