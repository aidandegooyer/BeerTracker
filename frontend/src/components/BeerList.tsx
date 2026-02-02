import { useState, useEffect } from "react";
import type { Beer } from "../types";
import { getBeers, deleteBeer, updateBeer } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CheckCircle, Circle } from "lucide-react";

interface BeerListProps {
  onSelectBeer: (beer: Beer) => void;
  onAddBeer: () => void;
}

export function BeerList({ onSelectBeer, onAddBeer }: BeerListProps) {
  const [beers, setBeers] = useState<Beer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<"none" | "rating" | "abv">("none");

  const fetchBeers = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBeers(query ? { q: query } : {});
      setBeers(data);
    } catch (err) {
      setError("Failed to load beers");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeers();
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      fetchBeers(value || undefined);
    }, 300);

    setSearchTimeout(timeout);
  };

  const getRatingColor = (rating: number) => {
    const colors: { [key: number]: string } = {
      5: "#ef4444", // red
      6: "#f97316", // orange
      7: "#eab308", // yellow
      8: "#84cc16", // lime
      9: "#22c55e", // green
      10: "#10b981", // emerald
    };
    const rounded = Math.round(rating);
    return colors[rounded] || "#6b7280"; // gray fallback
  };

  const getSortedBeers = () => {
    const sorted = [...beers];
    if (sortBy === "rating") {
      sorted.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sortBy === "abv") {
      sorted.sort((a, b) => (Number(b.abv) || 0) - (Number(a.abv) || 0));
    }
    return sorted;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="inline justify-between items-center gap-4 md:flex space-y-4">
        <h1 className="text-3xl font-bold">Beer Collection</h1>
        <div className="flex gap-2 items-center">
          Sort By:
          <Button
            variant={sortBy === "none" ? "default" : "outline"}
            onClick={() => setSortBy("none")}
            size="sm"
          >
            Default
          </Button>
          <Button
            variant={sortBy === "rating" ? "default" : "outline"}
            onClick={() => setSortBy("rating")}
            size="sm"
          >
            Rating
          </Button>
          <Button
            variant={sortBy === "abv" ? "default" : "outline"}
            onClick={() => setSortBy("abv")}
            size="sm"
          >
            ABV
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search beers by name, brand, or type..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          Loading beers...
        </div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive">{error}</div>
      )}

      {!loading && !error && beers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>
            No beers found.{" "}
            {searchQuery ? "Try a different search." : "Add your first beer!"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getSortedBeers().map((beer) => (
          <Card
            key={beer.id}
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
            onClick={() => onSelectBeer(beer)}
          >
            <CardHeader>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <CardTitle className="text-xl">{beer.name}</CardTitle>
                  <CardDescription className="font-medium">
                    {beer.brand}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {beer.rating ? (
                    <Badge
                      className="text-white"
                      style={{
                        backgroundColor: getRatingColor(Number(beer.rating)),
                      }}
                    >
                      {Number(beer.rating).toFixed(1)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">—</Badge>
                  )}
                  <div className="h-8 w-8 flex items-center justify-center">
                    {beer.verified ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {beer.type && <Badge variant="outline">{beer.type}</Badge>}
                {beer.container && (
                  <Badge variant="outline" className="capitalize">
                    {beer.container}
                  </Badge>
                )}
                {beer.abv && <Badge variant="outline">{beer.abv}% ABV</Badge>}
              </div>

              {beer.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {beer.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
