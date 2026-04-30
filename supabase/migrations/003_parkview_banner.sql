-- Set default banner for demo property
update sites
set cover_image_url = '/banner.jpg'
where slug = 'parkview-demo';
