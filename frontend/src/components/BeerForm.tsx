import { useState, useEffect } from "react";
import type { Beer } from "../types";
import {
  createBeer,
  updateBeer,
  createRating,
  updateRating,
  deleteBeer,
} from "../api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, CheckCircle, Circle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BeerFormProps {
  beer?: Beer;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BeerForm({ beer, open, onClose, onSuccess }: BeerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: "",
    name: "",
    type: "",
    description: "",
    container: "",
    abv: "",
    rating: "",
    verified: false,
  });

  // Update form data when beer prop changes
  useEffect(() => {
    if (beer) {
      setFormData({
        brand: beer.brand || "",
        name: beer.name || "",
        type: beer.type || "",
        description: beer.description || "",
        container: beer.container || "",
        abv: beer.abv?.toString() || "",
        rating: beer.rating?.toString() || "",
        verified: beer.verified || false,
      });
    } else {
      setFormData({
        brand: "",
        name: "",
        type: "",
        description: "",
        container: "",
        abv: "",
        rating: "",
        verified: false,
      });
    }
  }, [beer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        brand: formData.brand,
        name: formData.name,
        type: formData.type || undefined,
        description: formData.description || undefined,
        container:
          (formData.container as "draught" | "can" | "bottle" | "") ||
          undefined,
        abv: formData.abv ? parseFloat(formData.abv) : undefined,
        verified: formData.verified,
      };

      let beerId: string;
      if (beer) {
        const updatedBeer = await updateBeer(beer.id, data);
        beerId = updatedBeer.id;
      } else {
        const newBeer = await createBeer(data);
        beerId = newBeer.id;
      }

      // Add or update rating if provided
      if (formData.rating) {
        if (beer?.rating_id) {
          // Update existing rating
          await updateRating(beer.rating_id, {
            score: parseFloat(formData.rating),
          });
        } else {
          // Create new rating
          await createRating({
            beer_id: beerId,
            score: parseFloat(formData.rating),
          });
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save beer");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!beer) return;

    if (
      !confirm(`Are you sure you want to delete ${beer.brand} ${beer.name}?`)
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteBeer(beer.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete beer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{beer ? "Edit Beer" : "Add New Beer"}</DialogTitle>
          <DialogDescription>
            {beer
              ? "Update the beer information below."
              : "Enter the details of the new beer."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) =>
                  setFormData({ ...formData, brand: e.target.value })
                }
                placeholder="e.g., Guinness"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Draught"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                placeholder="e.g., Stout, IPA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="container">Container</Label>
              <Select
                value={formData.container}
                onValueChange={(value) =>
                  setFormData({ ...formData, container: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draught">Draught</SelectItem>
                  <SelectItem value="can">Can</SelectItem>
                  <SelectItem value="bottle">Bottle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="abv">ABV %</Label>
              <Input
                id="abv"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.abv}
                onChange={(e) =>
                  setFormData({ ...formData, abv: e.target.value })
                }
                placeholder="e.g., 5.6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Rating (1-10)</Label>
              <Input
                id="rating"
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={formData.rating}
                onChange={(e) =>
                  setFormData({ ...formData, rating: e.target.value })
                }
                placeholder="e.g., 6.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the beer..."
              rows={3}
            />
          </div>

          {beer && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-md">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setFormData({ ...formData, verified: !formData.verified })
                  }
                >
                  {formData.verified ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </Button>
                <div>
                  <Label className="text-sm font-medium">
                    {formData.verified ? "Verified" : "Not Verified"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Mark this review as verified (tasted by 2+ people)
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : beer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
