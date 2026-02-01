import { useState, useRef } from "react";
import type { BeerMatch } from "../types";
import { uploadMenu, getMenuParse, matchDetected } from "../api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2 } from "lucide-react";

interface MenuScannerProps {
  onBeerSelect: (beerId: string) => void;
}

export function MenuScanner({ onBeerSelect }: MenuScannerProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [matches, setMatches] = useState<BeerMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setUploading(true);
    setProcessing(true);
    setError(null);
    setMatches([]);

    try {
      // Upload image
      const uploadResult = await uploadMenu(file);
      setUploading(false);

      // Poll for OCR results
      let attempts = 0;
      const maxAttempts = 20; // 20 seconds max

      const pollResults = async () => {
        try {
          const parseResult = await getMenuParse(uploadResult.image_id);

          if (parseResult.parsed_beers && parseResult.parsed_beers.length > 0) {
            // Match detected beers
            const beerNames = parseResult.parsed_beers.map((b: any) => b.text);
            const matchResults = await matchDetected({
              parsed_beers: beerNames,
            });
            setMatches(matchResults);
            setProcessing(false);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(pollResults, 1000);
          } else {
            setError("OCR processing took too long. Please try again.");
            setProcessing(false);
          }
        } catch (err: any) {
          console.log(
            `Poll attempt ${attempts + 1}/${maxAttempts}, error:`,
            err.message,
          );
          if (err.status === 404 && attempts < maxAttempts) {
            attempts++;
            setTimeout(pollResults, 1000);
          } else if (attempts >= maxAttempts) {
            setError("OCR processing took too long. Please try again.");
            setProcessing(false);
          } else {
            setError(err.message || "Failed to process menu image");
            setProcessing(false);
          }
        }
      };

      pollResults();
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return "bg-green-500";
    if (rating >= 6) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scan Menu</CardTitle>
          <CardDescription>
            Upload a photo of a beer menu to see which beers you've already
            rated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || processing}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photo
                </>
              )}
            </Button>
          </div>

          {processing && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              Processing image with OCR...
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            Found {matches.length} Matching Beers
          </h3>

          <div className="grid gap-3">
            {matches.map((match, index) => (
              <Card
                key={`${match.beer.id}-${index}`}
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary"
                onClick={() => onBeerSelect(match.beer.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{match.beer.name}</h4>
                        {match.beer.rating ? (
                          <Badge
                            className={`${getRatingColor(match.beer.rating)} text-white text-xs`}
                          >
                            {Number(match.beer.rating).toFixed(1)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Unrated
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {match.beer.brand}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {match.beer.type && (
                          <Badge variant="outline" className="text-xs">
                            {match.beer.type}
                          </Badge>
                        )}
                        {match.beer.abv && (
                          <Badge variant="outline" className="text-xs">
                            {match.beer.abv}% ABV
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Match: {(match.similarity * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        "{match.matched_text}"
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
