import React, { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface FoodItem {
  id: number;
  description: string;
  energy_kcal: number;
  protein_g: number;
  lipid_g: number;
  carbohydrate_g: number;
  fiber_g: number;
}

interface SelectedFood {
  item: FoodItem;
  quantity: number;
}

interface CalculationResult {
  insulin_needed: number;
  energy_kcal: number;
  protein_g: number;
  lipid_g: number;
  carbohydrate_g: number;
  fiber_g: number;
  percentages: {
    carbohydrate: number;
    protein: number;
    lipid: number;
  };
}

const itemsPerTable = 60;
const COLORS = ["#e6733b", "#359acc", "#e4a616"];

function QuantityInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="quantity-control">
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const val = Math.max(1, Number(e.target.value) || 1);
          onChange(val);
        }}
        min="1"
        disabled={disabled}
        className="quantity-input"
      />
      <span>g</span>
    </div>
  );
}

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [selectedFoods, setSelectedFoods] = useState(
    new Map<number, SelectedFood>(),
  );
  const [calculationResult, setCalculationResult] =
    useState<CalculationResult | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const nutritionTimeout = useRef<NodeJS.Timeout | null>(null);

  const searchFood = async (query: string) => {
    try {
      const response = await fetch("https://www.nutritionall.xyz/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: query,
          categories: [],
          ascending: false,
          max_results: itemsPerTable,
        }),
      });
      const data = await response.json();
      if (!Array.isArray(data.items)) {
        alert("No results returned from the API.");
        return;
      }
      setFoodItems(data.items);
    } catch (error) {
      console.error("Search Error:", error);
    }
  };

  const calculateNutrition = async () => {
    if (selectedFoods.size === 0) {
      setCalculationResult(null);
      return;
    }

    const meal = Array.from(selectedFoods.values()).map(
      ({ item, quantity }) => ({
        food_id: item.id,
        grams: quantity,
      }),
    );

    try {
      const response = await fetch(
        "https://www.nutritionall.xyz/api/calculate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            factor_insulin_cho: 10,
            meal,
            mode: "carbo",
          }),
        },
      );
      const data = await response.json();
      setCalculationResult(data);
    } catch (error) {
      console.error("Calculation Error:", error);
    }
  };

  const toggleFoodSelection = (item: FoodItem) => {
    const newSelectedFoods = new Map(selectedFoods);
    if (newSelectedFoods.has(item.id)) {
      newSelectedFoods.delete(item.id);
    } else {
      newSelectedFoods.set(item.id, { item, quantity: 100 });
    }
    setSelectedFoods(newSelectedFoods);
  };

  const handleQuantityChange = (id: number, quantity: number) => {
    const newSelectedFoods = new Map(selectedFoods);
    const food = newSelectedFoods.get(id);
    if (food) {
      newSelectedFoods.set(id, { ...food, quantity });
      setSelectedFoods(newSelectedFoods);
    }
  };

  useEffect(() => {
    searchFood("");
  }, []);

  useEffect(() => {
    if (nutritionTimeout.current) clearTimeout(nutritionTimeout.current);
    nutritionTimeout.current = setTimeout(() => {
      calculateNutrition();
    }, 400);
  }, [selectedFoods]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchFood(value), 400);
  };

  const renderPieChart = () => {
    if (!calculationResult) return null;
    const data = [
      { name: "Carbs", value: calculationResult.percentages.carbohydrate },
      { name: "Protein", value: calculationResult.percentages.protein },
      { name: "Fat", value: calculationResult.percentages.lipid },
    ];

    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}g`} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="app-container">
      {calculationResult && (
        <div className="calculation-result">
          <div className="pie-section">{renderPieChart()}</div>
          <div className="nutrition-stack">
            <div className="stack-item stack-insulin">
              <span>Insulin</span>
              <span>{calculationResult.insulin_needed.toFixed(1)}u</span>
            </div>
            <div className="stack-item stack-energy">
              <span>Energy</span>
              <span>{calculationResult.energy_kcal.toFixed(1)}kcal</span>
            </div>
            <div className="stack-item stack-carbs">
              <span>Carbs</span>
              <span>{calculationResult.carbohydrate_g.toFixed(1)}g</span>
            </div>
            <div className="stack-item stack-protein">
              <span>Protein</span>
              <span>{calculationResult.protein_g.toFixed(1)}g</span>
            </div>
            <div className="stack-item stack-fat">
              <span>Fat</span>
              <span>{calculationResult.lipid_g.toFixed(1)}g</span>
            </div>
            <div className="stack-item stack-fiber">
              <span>Fiber</span>
              <span>{calculationResult.fiber_g.toFixed(1)}g</span>
            </div>
            <div className="selected-foods-list">
              {Array.from(selectedFoods.values()).map(({ item, quantity }) => (
                <div key={item.id} className="selected-food-item">
                  <span>{item.description}</span>
                  <QuantityInput
                    value={quantity}
                    onChange={(v) => handleQuantityChange(item.id, v)}
                  />
                  <button
                    onClick={() => toggleFoodSelection(item)}
                    className="remove-button"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="food-section">
        <div className="search-container">
          {selectedFoods.size === 0 && (
            <h1 className="nutrilin-title">Nutrilin</h1>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search for food..."
            className="search-input"
          />
        </div>

        <div className="food-list-container">
          <div className="food-list">
            {foodItems.map((item) => (
              <div
                key={item.id}
                className={`food-card ${
                  selectedFoods.has(item.id) ? "selected" : ""
                }`}
                onClick={() => toggleFoodSelection(item)}
              >
                <div className="food-card-header">
                  <h3>{item.description}</h3>
                </div>
                <div className="food-card-content">
                  <div className="nutrition-data">
                    <p className="energy">
                      {(item.energy_kcal ?? 0).toFixed(0)} kcal
                    </p>
                    <p>Carbs: {(item.carbohydrate_g ?? 0).toFixed(1)}g</p>
                    <p>Protein: {(item.protein_g ?? 0).toFixed(1)}g</p>
                    <p>Fiber: {(item.fiber_g ?? 0).toFixed(1)}g</p>
                    <p>Fat: {(item.lipid_g ?? 0).toFixed(1)}g</p>
                  </div>
                  <QuantityInput
                    value={selectedFoods.get(item.id)?.quantity || 100}
                    onChange={(v) => handleQuantityChange(item.id, v)}
                    disabled={!selectedFoods.has(item.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
