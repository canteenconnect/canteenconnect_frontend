import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mask-gradient">
      <Button
        variant="outline"
        onClick={() => onSelect("all")}
        className={cn(
          "flex-shrink-0 rounded-full border-zinc-700 bg-zinc-900 px-4 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 sm:px-6 sm:text-sm",
          selected === "all" && "border-zinc-100 bg-zinc-100 text-zinc-900 hover:bg-white hover:text-zinc-950",
        )}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category}
          variant="outline"
          onClick={() => onSelect(category)}
          className={cn(
            "flex-shrink-0 rounded-full border-zinc-700 bg-zinc-900 px-4 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 sm:px-6 sm:text-sm",
            selected === category && "border-zinc-100 bg-zinc-100 text-zinc-900 hover:bg-white hover:text-zinc-950",
          )}
        >
          {category}
        </Button>
      ))}
    </div>
  );
}
