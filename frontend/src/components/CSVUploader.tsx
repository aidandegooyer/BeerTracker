import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Papa from "papaparse";
import { createBeer, createRating } from "../api";

interface CSVBeer {
  Brand: string;
  Name: string;
  Type?: string;
  Description?: string;
  "ABV %"?: string;
  Rating?: string;
}

export function CSVUploader({ onComplete }: { onComplete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setResults(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse<CSVBeer>(text, {
        header: true,
        skip_empty_lines: true,
        dynamicTyping: false,
      });

      if (!parsed.data || parsed.data.length === 0) {
        setResults({
          success: 0,
          failed: parsed.data?.length || 0,
          errors: ["No valid rows found in CSV"],
        });
        setUploading(false);
        return;
      }

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < parsed.data.length; i++) {
        const beer = parsed.data[i];

        try {
          // Validate required fields
          if (!beer.Brand?.trim() || !beer.Name?.trim()) {
            failed++;
            errors.push(`Row ${i + 1}: Missing brand or name`);
            setProgress(Math.round(((i + 1) / parsed.data.length) * 100));
            continue;
          }

          const abv = beer["ABV %"] ? parseFloat(beer["ABV %"]) : null;

          const createdBeer = await createBeer({
            brand: beer.Brand.trim(),
            name: beer.Name.trim(),
            type: beer.Type?.trim() || undefined,
            description: beer.Description?.trim() || undefined,
            abv: isNaN(abv as number) ? undefined : abv,
          });

          // Create rating if provided
          if (beer.Rating) {
            const rating = parseFloat(beer.Rating);
            if (!isNaN(rating) && rating >= 1 && rating <= 10) {
              try {
                await createRating({
                  beer_id: createdBeer.id,
                  score: rating,
                });
              } catch (ratingErr) {
                console.error(
                  `Failed to create rating for ${beer.Brand} - ${beer.Name}:`,
                  ratingErr,
                );
                // Don't fail the whole upload if rating creation fails
              }
            }
          }

          success++;
        } catch (err) {
          failed++;
          errors.push(
            `Row ${i + 1} (${beer.Brand} - ${beer.Name}): ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          );
        }

        setProgress(Math.round(((i + 1) / parsed.data.length) * 100));
      }

      setResults({ success, failed, errors });
      onComplete();
    } catch (err) {
      setResults({
        success: 0,
        failed: 1,
        errors: [err instanceof Error ? err.message : "Failed to parse CSV"],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label htmlFor="csv-upload">
          <Button asChild disabled={uploading} className="cursor-pointer">
            <span>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </span>
          </Button>
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Uploading... {progress}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
          <div className="font-semibold">
            Upload Complete: {results.success} succeeded, {results.failed}{" "}
            failed
          </div>
          {results.errors.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-destructive">
                Errors:
              </div>
              <ul className="text-sm text-destructive space-y-1 max-h-32 overflow-y-auto">
                {results.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {results.errors.length > 10 && (
                  <li>... and {results.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
