import { Button } from "@/components/ui/button";

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mask-gradient">
      <Button
        variant={selected === "all" ? "default" : "outline"}
        onClick={() => onSelect("all")}
        className="rounded-full px-6 flex-shrink-0"
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category}
          variant={selected === category ? "default" : "outline"}
          onClick={() => onSelect(category)}
          className="rounded-full px-6 flex-shrink-0"
        >
          {category}
        </Button>
      ))}
    </div>
  );
}
