-- Menu items with inventory
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  category text not null, -- 'slice', 'pie', 'extra'
  available boolean default true,
  image_url text,
  created_at timestamptz default now()
);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  items jsonb not null, -- array of {item_id, name, price, quantity}
  subtotal numeric(10,2),
  total numeric(10,2),
  status text default 'pending', -- pending, paid, preparing, ready, completed, cancelled
  pickup_time text, -- requested pickup time
  stripe_payment_intent_id text,
  stripe_payment_status text,
  notes text,
  created_at timestamptz default now()
);

-- Daily inventory (how many of each item available today)
create table daily_inventory (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id),
  date date default current_date,
  quantity_available integer default 0,
  quantity_sold integer default 0,
  created_at timestamptz default now(),
  unique(menu_item_id, date)
);

-- Seed menu items
insert into menu_items (name, description, price, category) values
  ('Cheese Slice', 'Housemade tomato sauce, fresh mozzarella', 5.00, 'slice'),
  ('Pepperoni Slice', 'Sauce, mozz, cupped pepperoni', 6.00, 'slice'),
  ('Cheese Pie (16")', 'Housemade tomato sauce, fresh mozzarella', 24.00, 'pie'),
  ('Cayucos Margherita', 'San Marzano tomato, fresh mozz, basil', 24.00, 'pie'),
  ('Pepperoni Pie', 'The one they judge you by', 25.00, 'pie'),
  ('Sausage & Peppers', 'Cayucos Sausage Co. meat', 25.00, 'pie'),
  ('Mushroom & White Sauce', 'Mighty Cap mushrooms, garlic cream', 25.00, 'pie'),
  ('Rotating Seasonal', 'Ask about today''s special', 25.00, 'pie'),
  ('Housemade Ranch', 'Dipping sauce', 1.00, 'extra'),
  ('Hot Honey', 'Drizzle on any pie', 1.00, 'extra'),
  ('Cayucos Hot Sauce', 'Local & legendary', 1.00, 'extra'),
  ('Leo Leo Gelato', 'Cup of gelato', 5.00, 'extra');
