-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update all profiles (verify vendors, etc.)
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update all orders
CREATE POLICY "Admins can update all orders"
ON public.orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all order items
CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to manage all products
CREATE POLICY "Admins can manage all products"
ON public.products FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to manage categories
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all user roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to manage user roles
CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));