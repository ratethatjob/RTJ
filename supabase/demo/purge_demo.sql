-- Removes ALL demo data (companies, locations, reviews, replies, jobs, applications, plans, demo users).
-- Same as the admin "Demo data" tab. Returns the counts that were removed.
select private.purge_demo();
