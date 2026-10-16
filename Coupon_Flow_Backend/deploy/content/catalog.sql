
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `activity_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `user_name` varchar(120) NOT NULL,
  `action` varchar(40) NOT NULL,
  `subject_type` varchar(40) DEFAULT NULL,
  `subject_id` bigint(20) unsigned DEFAULT NULL,
  `subject_label` varchar(190) DEFAULT NULL,
  `changes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`changes`)),
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `activity_logs_user_id_foreign` (`user_id`),
  KEY `activity_logs_subject_type_subject_id_index` (`subject_type`,`subject_id`),
  KEY `activity_logs_action_index` (`action`),
  KEY `activity_logs_created_at_index` (`created_at`),
  CONSTRAINT `activity_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=950 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `blogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blogs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `author_id` bigint(20) unsigned DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `excerpt` text DEFAULT NULL,
  `body` longtext DEFAULT NULL,
  `featured_image` varchar(255) DEFAULT NULL,
  `meta_title` varchar(255) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `meta_keywords` varchar(500) DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'Draft',
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blogs_slug_unique` (`slug`),
  KEY `blogs_category_id_foreign` (`category_id`),
  KEY `blogs_author_id_foreign` (`author_id`),
  KEY `blogs_status_index` (`status`),
  CONSTRAINT `blogs_author_id_foreign` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `blogs_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(10) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_type_slug_unique` (`type`,`slug`),
  KEY `categories_type_index` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `coupon_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coupon_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `coupon_id` bigint(20) unsigned NOT NULL,
  `code` varchar(100) NOT NULL,
  `redemption_id` bigint(20) unsigned DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_codes_coupon_id_code_unique` (`coupon_id`,`code`),
  UNIQUE KEY `coupon_codes_redemption_id_unique` (`redemption_id`),
  KEY `coupon_codes_coupon_id_redemption_id_index` (`coupon_id`,`redemption_id`),
  CONSTRAINT `coupon_codes_coupon_id_foreign` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coupon_codes_redemption_id_foreign` FOREIGN KEY (`redemption_id`) REFERENCES `redemptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coupons` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `store_id` bigint(20) unsigned NOT NULL,
  `feed_source_id` bigint(20) unsigned DEFAULT NULL,
  `external_id` varchar(190) DEFAULT NULL,
  `imported_hash` char(64) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `type` varchar(30) NOT NULL,
  `code` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `tracking_url` varchar(2048) DEFAULT NULL,
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Draft',
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `is_exclusive` tinyint(1) NOT NULL DEFAULT 0,
  `unique_codes` tinyint(1) NOT NULL DEFAULT 0,
  `max_codes_per_visitor` smallint(5) unsigned NOT NULL DEFAULT 5,
  `commission_percent` decimal(5,2) DEFAULT NULL,
  `usage_limit` int(10) unsigned DEFAULT NULL,
  `uses_count` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_feed_source_id_external_id_unique` (`feed_source_id`,`external_id`),
  KEY `coupons_store_id_foreign` (`store_id`),
  KEY `coupons_expires_at_index` (`expires_at`),
  KEY `coupons_status_index` (`status`),
  CONSTRAINT `coupons_feed_source_id_foreign` FOREIGN KEY (`feed_source_id`) REFERENCES `feed_sources` (`id`) ON DELETE SET NULL,
  CONSTRAINT `coupons_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `feed_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `feed_sources` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `type` varchar(20) NOT NULL,
  `url` varchar(2048) DEFAULT NULL,
  `api_key` text DEFAULT NULL,
  `default_store_id` bigint(20) unsigned DEFAULT NULL,
  `frequency` varchar(20) NOT NULL DEFAULT 'manual',
  `auto_publish` tinyint(1) NOT NULL DEFAULT 0,
  `deactivate_missing` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_run_at` timestamp NULL DEFAULT NULL,
  `last_status` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `feed_sources_default_store_id_foreign` (`default_store_id`),
  CONSTRAINT `feed_sources_default_store_id_foreign` FOREIGN KEY (`default_store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `type` varchar(255) NOT NULL,
  `notifiable_type` varchar(255) NOT NULL,
  `notifiable_id` bigint(20) unsigned NOT NULL,
  `data` text NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=165 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `redemptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reference` varchar(255) NOT NULL,
  `user_name` varchar(255) NOT NULL,
  `coupon_code` varchar(100) NOT NULL,
  `store_id` bigint(20) unsigned DEFAULT NULL,
  `coupon_id` bigint(20) unsigned DEFAULT NULL,
  `order_value_cents` int(10) unsigned NOT NULL DEFAULT 0,
  `commission_cents` int(10) unsigned NOT NULL DEFAULT 0,
  `clicked_at` timestamp NULL DEFAULT NULL,
  `redeemed_at` timestamp NULL DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `tracking_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `claim_token` char(64) DEFAULT NULL,
  `visitor_hash` char(64) DEFAULT NULL,
  `commission_percent` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `redemptions_reference_unique` (`reference`),
  UNIQUE KEY `redemptions_coupon_id_claim_token_unique` (`coupon_id`,`claim_token`),
  KEY `redemptions_store_id_foreign` (`store_id`),
  KEY `redemptions_status_index` (`status`),
  KEY `redemptions_visitor_hash_index` (`visitor_hash`),
  CONSTRAINT `redemptions_coupon_id_foreign` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `redemptions_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`value`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_unique` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `store_ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_ratings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `store_id` bigint(20) unsigned NOT NULL,
  `rating` tinyint(3) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `voter` char(64) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `store_ratings_store_id_voter_unique` (`store_id`,`voter`),
  KEY `store_ratings_user_id_foreign` (`user_id`),
  CONSTRAINT `store_ratings_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `store_ratings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stores` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `heading` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `direct_url` varchar(2048) NOT NULL,
  `tracking_url` varchar(2048) DEFAULT NULL,
  `logo_path` varchar(255) DEFAULT NULL,
  `meta_title` varchar(255) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `meta_keywords` varchar(500) DEFAULT NULL,
  `is_top` tinyint(1) NOT NULL DEFAULT 0,
  `is_editor_choice` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'Draft',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `commission_percent` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stores_slug_unique` (`slug`),
  KEY `stores_category_id_foreign` (`category_id`),
  KEY `stores_status_index` (`status`),
  CONSTRAINT `stores_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sync_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sync_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `feed_source_id` bigint(20) unsigned DEFAULT NULL,
  `reference` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  `stores_added` int(10) unsigned NOT NULL DEFAULT 0,
  `coupons_added` int(10) unsigned NOT NULL DEFAULT 0,
  `coupons_updated` int(10) unsigned NOT NULL DEFAULT 0,
  `coupons_kept` int(10) unsigned NOT NULL DEFAULT 0,
  `coupons_deactivated` int(10) unsigned NOT NULL DEFAULT 0,
  `failed` int(10) unsigned NOT NULL DEFAULT 0,
  `errors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`errors`)),
  `status` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sync_runs_reference_unique` (`reference`),
  KEY `sync_runs_status_index` (`status`),
  KEY `sync_runs_feed_source_id_foreign` (`feed_source_id`),
  CONSTRAINT `sync_runs_feed_source_id_foreign` FOREIGN KEY (`feed_source_id`) REFERENCES `feed_sources` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `two_factor_secret` text DEFAULT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  `two_factor_last_step` bigint(20) unsigned DEFAULT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'customer',
  `disabled_at` timestamp NULL DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_index` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `blogs` WRITE;
/*!40000 ALTER TABLE `blogs` DISABLE KEYS */;
INSERT INTO `blogs` VALUES (1,9,1,'Best Amazon Deals This September 2026','best-amazon-deals-this-september-2026','September is one of the quietest months for Amazon prices, which makes it one of the best. Here is where the real discounts hide, how to tell a good deal from a fake one, and the codes worth saving before the holiday rush.','Back-to-school is wrapping up, summer stock is being cleared and the big autumn sale events have not started yet. That gap makes September one of the best months of the year to buy on Amazon, as long as you know where to look. This guide walks through the places real discounts appear, how to check that a price is actually low, and the habits that save the most over a year.\r\n\r\n> **Quick tip:** before you buy anything over $50, check our [Amazon coupon page](/stores/amazon) for a working code. It takes ten seconds and the codes are checked by hand.\r\n\r\n## Where the real Amazon discounts are\r\n\r\nAmazon runs thousands of promotions at once, but most of the meaningful savings come from a handful of places.\r\n\r\n### Today\'s Deals and limited-time offers\r\n\r\nThe Today\'s Deals page collects every active discount in one place. Limited-time offers usually run for a few hours and often have a claim bar that shows how much stock is left. Filter by department and by discount level (25% off or more is a good starting point) so you are not scrolling through minor markdowns.\r\n\r\n### Clippable coupons on product pages\r\n\r\nMany listings show a small coupon checkbox under the price, such as *Save 15% with coupon*. You have to tick it before adding the item to your cart, or the saving will not apply. These coupons stack with the listed sale price, so a discounted item with a coupon can end up far cheaper than it first appears.\r\n\r\n### Subscribe & Save\r\n\r\nFor things you buy again and again (coffee, cleaning supplies, pet food, vitamins), Subscribe & Save takes a percentage off every delivery. Add five or more subscriptions to the same delivery day and the discount usually increases. You can skip or cancel any delivery from your account, so there is no long-term commitment.\r\n\r\n### Renewed and Amazon Resale\r\n\r\nRenewed products are inspected and tested, and come with a return window and a guarantee. Amazon Resale (formerly Warehouse) sells returned items, often in perfect condition, at a clear discount. Both are excellent for electronics, kitchen appliances and tools.\r\n\r\n## How to tell if a deal is actually good\r\n\r\nA red price tag does not always mean a low price. Use these checks before you buy:\r\n\r\n1. **Look at the price history.** Free price-tracking tools show what an item has cost over the past months. If today\'s \"deal\" matches the usual price, it is not a deal.\r\n2. **Compare the seller.** The same product can be listed by several sellers. Check who ships it and the seller\'s rating, not just the price.\r\n3. **Read recent reviews.** Sort reviews by most recent. A product that changed manufacturers can drop in quality while keeping old five-star ratings.\r\n4. **Check the unit price.** For groceries and household goods, compare the price per ounce or per item. Bigger packs are not always cheaper.\r\n5. **Add the coupon.** A slightly higher price with a clippable coupon can beat a lower price without one.\r\n\r\n## Categories worth watching in September\r\n\r\n- **Summer gear:** fans, outdoor furniture, pool supplies and camping equipment are cleared to make room for autumn stock.\r\n- **Laptops and tablets:** back-to-school promotions often linger into the middle of the month.\r\n- **Kitchen appliances:** air fryers, blenders and coffee makers see steady discounts ahead of the holiday season.\r\n- **Amazon devices:** Echo, Kindle and Fire TV prices tend to dip in the weeks before Amazon\'s autumn sale event.\r\n\r\n## Plan ahead for the autumn sale\r\n\r\nAmazon usually holds a large members\' sale event in October, followed by Black Friday and Cyber Monday. If an item you need is already at its lowest price in September, buy it now. If not, add it to a wish list so you can compare when the event starts. Prices on popular items often drop a week or two before the official start.\r\n\r\n## Final checklist before you check out\r\n\r\n- Tick any coupon checkbox on the product page.\r\n- Search [our Amazon codes](/stores/amazon) for an extra discount.\r\n- Confirm the seller, shipping speed and return window.\r\n- Choose a slower, no-rush shipping option if Amazon offers a credit for it.\r\n\r\nA few minutes of checking adds up to real money over a year. Bookmark this page and come back next month: we update our [latest coupons](/coupons) every week.','blogs/fjvvRCkBD8Ne2Lt0ZIMr9pTFC8syXocM2kjcFTUM.jpg','Best Amazon Deals This September 2026','Where to find real Amazon discounts this September: Today\'s Deals, clippable coupons, Subscribe & Save, Renewed and Warehouse, plus how to spot a fake sale.','amazon deals, amazon coupons, september deals, subscribe and save, amazon renewed, amazon warehouse',1,'Published','2026-09-19 19:00:00','2026-09-29 18:07:06','2026-10-15 16:36:03',NULL);
INSERT INTO `blogs` VALUES (2,10,1,'Top 10 Nike Running Shoes on Sale','top-10-nike-running-shoes-on-sale','From daily trainers to race-day super shoes, these are the Nike running shoes most worth buying on sale, who each one suits, and how to pay less for them.','Nike makes a running shoe for almost every runner, but full price adds up quickly. The good news: older colourways and last season\'s versions go on sale regularly, and the differences between versions are often small. Here are ten shoes worth watching, grouped by the kind of running you do.\r\n\r\n> **Before you buy:** check our [Nike promo codes](/stores/nike). Nike codes often apply on top of sale prices for members.\r\n\r\n## Daily trainers\r\n\r\n### 1. Nike Pegasus\r\n\r\nThe all-rounder. The Pegasus is comfortable enough for easy miles, responsive enough for faster days and durable enough to last hundreds of miles. If you only buy one running shoe, this is the safest choice.\r\n\r\n### 2. Nike Vomero\r\n\r\nMore cushioning than the Pegasus with a softer, smoother ride. A great pick for long runs, heavier runners or anyone who wants extra comfort on recovery days.\r\n\r\n### 3. Nike Winflo\r\n\r\nA budget-friendly daily trainer with a familiar feel. On sale, it is one of the best value running shoes Nike makes.\r\n\r\n### 4. Nike Revolution\r\n\r\nAn entry-level shoe for new runners, gym sessions and walking. Light, simple and very affordable when discounted.\r\n\r\n## Max cushion and stability\r\n\r\n### 5. Nike Invincible\r\n\r\nNike\'s most cushioned road shoe. The bouncy foam protects your legs on long, slow runs and makes it a favourite for marathon training blocks.\r\n\r\n### 6. Nike Structure\r\n\r\nA supportive shoe for runners whose feet roll inward. It adds stability without feeling stiff or heavy.\r\n\r\n## Tempo and race day\r\n\r\n### 7. Nike Zoom Fly\r\n\r\nA carbon-plated trainer for tempo runs and long workouts. It gives you a taste of race-day speed at a lower price than the top racing shoes.\r\n\r\n### 8. Nike Vaporfly\r\n\r\nA lightweight racing shoe with a carbon plate and highly responsive foam. Ideal for 5K to marathon races if you want every possible second.\r\n\r\n### 9. Nike Alphafly\r\n\r\nNike\'s maximum-performance marathon shoe, with extra cushioning and energy return. Sale prices on older colourways make it far more approachable.\r\n\r\n## Trail\r\n\r\n### 10. Nike Pegasus Trail\r\n\r\nThe road-to-trail shoe. Grippy enough for park paths and light trails, comfortable enough to run to the trailhead.\r\n\r\n## How to pay less for Nike running shoes\r\n\r\n1. **Join Nike Membership.** It is free, and members get access to member-only prices, early sales and promo codes.\r\n2. **Shop older colourways.** The newest colour is always full price. The same shoe in last season\'s colour is often discounted.\r\n3. **Check the previous version.** When a new version launches, the old one usually drops in price. The changes are often minor.\r\n4. **Stack a promo code.** Look for a [Nike code](/stores/nike) that applies to sale items before you check out.\r\n5. **Compare other retailers.** Stores such as [Adidas](/stores/adidas) and major sports retailers run competing sales, which can push Nike prices down too.\r\n\r\n## Choosing the right shoe\r\n\r\n- **New to running:** Revolution or Winflo.\r\n- **One shoe for everything:** Pegasus.\r\n- **Long, easy miles:** Vomero or Invincible.\r\n- **Need support:** Structure.\r\n- **Racing:** Zoom Fly to train, Vaporfly or Alphafly to race.\r\n\r\nWhatever you choose, buy for fit first and price second. Try your usual size, check the return policy and keep the box until you have run in them indoors.',NULL,'Top 10 Nike Running Shoes on Sale','The ten Nike running shoes worth buying on sale, from the Pegasus to the Alphafly, who each suits, and how to stack Nike discounts and promo codes.','nike running shoes, nike sale, nike promo code, pegasus, vomero, invincible, vaporfly',0,'Draft',NULL,'2026-09-29 18:07:07','2026-10-15 16:35:29',NULL);
INSERT INTO `blogs` VALUES (3,11,1,'How to Save Big at Walmart','how-to-save-big-at-walmart','Walmart is already known for low prices, but a few simple habits can cut your bill much further. Here are the tools, timing tricks and membership perks that save the most.','Walmart\'s everyday low prices are a good start, but they are only the start. Regular shoppers who plan a little and use the right tools save far more than those who simply walk the aisles. These are the habits that make the biggest difference.\r\n\r\n> **Save first, shop second:** see the latest [Walmart coupon codes](/stores/walmart) before you start your order.\r\n\r\n## Use the right Walmart tools\r\n\r\n### Shop the Rollbacks\r\n\r\nRollbacks are temporary price cuts that can last for weeks. They are marked with a Rollback tag in stores and online. Stock up on non-perishables when your regular items are on Rollback.\r\n\r\n### Check clearance and \"reduced price\" items\r\n\r\nClearance items are being removed from the range, and prices often drop again over time. Seasonal goods (summer furniture, holiday decorations, school supplies) are discounted heavily after the season ends.\r\n\r\n### Use the Walmart app in store\r\n\r\nThe app shows prices, stock levels and the aisle where each item sits. Use it to compare sizes and check online prices before you put something in your cart.\r\n\r\n### Order pickup instead of browsing\r\n\r\nFree pickup on qualifying orders keeps you away from impulse buys. When you only add what is on your list, the total stays under control.\r\n\r\n## Time your shopping\r\n\r\n- **Shop seasonal sales:** back-to-school in summer, the big autumn deal events and post-holiday clearance in January offer the deepest cuts.\r\n- **Watch for weekly deals:** new online deals go live regularly. Check the Deals page before you place your order.\r\n- **Buy store brands:** Great Value and Equate products are usually far cheaper than name brands and are often made to the same standard.\r\n\r\n## Is Walmart+ worth it?\r\n\r\nWalmart+ is a paid membership that includes free delivery on qualifying grocery orders, fuel discounts at participating stations and a streaming subscription. It pays for itself if you:\r\n\r\n1. Order groceries for delivery at least twice a month.\r\n2. Fill up at participating fuel stations regularly.\r\n3. Would pay for a streaming service anyway.\r\n\r\nIf you shop in store once a week and rarely order delivery, you may not need it. Try the free trial when one is offered and track how much you actually save.\r\n\r\n## Stack your savings\r\n\r\n### Combine coupon codes and promotions\r\n\r\nOnline orders can often use a [Walmart promo code](/stores/walmart) alongside Rollback prices. New customers and first-time delivery orders frequently get extra discounts.\r\n\r\n### Use cashback and rewards\r\n\r\nCashback apps and rewards credit cards return a small percentage of what you spend. On a weekly grocery bill, that adds up to a meaningful amount over a year.\r\n\r\n### Compare unit prices\r\n\r\nThe shelf label shows the price per ounce, pound or count. A bigger pack is usually cheaper per unit, but not always, especially when a smaller size is on Rollback.\r\n\r\n## A simple weekly routine\r\n\r\n1. Plan meals around what you already have.\r\n2. Write a list and check the app for Rollbacks on those items.\r\n3. Look for a [coupon code](/coupons) before you place an online order.\r\n4. Choose pickup to avoid impulse buys.\r\n5. Review your receipt for missed savings.\r\n\r\n## The bottom line\r\n\r\nSaving big at Walmart is less about one secret trick and more about steady habits: buy store brands, shop Rollbacks and clearance, plan your list and always check for a code. Done consistently, these habits can cut your monthly spending without changing what you buy.','blogs/JkTJCmkKlugvLq60aIjrKcA1cXEohCMWBSDzVMSa.jpg','How to Save Big at Walmart: Practical Tips','Practical ways to spend less at Walmart: Rollbacks, clearance, pickup and delivery, Walmart+, the Walmart app, cashback and coupon codes that actually work.','walmart savings, walmart coupons, walmart rollback, walmart clearance, walmart plus, walmart tips',1,'Published','2026-09-14 19:00:00','2026-09-29 18:07:07','2026-10-15 16:36:03',NULL);
INSERT INTO `blogs` VALUES (4,10,1,'Fall Fashion Trends & Discount Codes','fall-fashion-trends-discount-codes','The autumn pieces worth investing in this season, how to build a versatile wardrobe without overspending, and where to find discount codes from your favourite fashion stores.','Autumn is the season when a wardrobe works hardest: layering pieces, outerwear and boots all come out at once. That makes it easy to overspend. This guide covers the trends worth following, the staples worth investing in and the smartest ways to pay less for all of it.\r\n\r\n> **Shopping this week?** Browse [fashion discount codes](/categories/fashion) from stores such as [Nike](/stores/nike), [Adidas](/stores/adidas) and [Target](/stores/target) before you check out.\r\n\r\n## The trends worth following\r\n\r\n### Rich, earthy colours\r\n\r\nChocolate brown, olive, burgundy and camel continue to lead the season. They pair easily with denim and neutrals, so one new colourful piece can refresh an entire wardrobe.\r\n\r\n### Relaxed tailoring\r\n\r\nWide-leg trousers, oversized blazers and soft-shouldered coats feel polished without being stiff. Look for natural fabrics such as wool blends that hold their shape.\r\n\r\n### Texture and layering\r\n\r\nChunky knits, suede, corduroy and quilted jackets add depth to simple outfits. Layering a fine knit under a shirt or blazer is an easy way to look put-together on cool mornings.\r\n\r\n### Practical boots\r\n\r\nLug-sole boots, loafers with thicker soles and classic knee-high boots are both stylish and practical for wet weather.\r\n\r\n## Wardrobe staples worth investing in\r\n\r\nTrends come and go. These pieces earn their place for years:\r\n\r\n- **A well-cut coat** in a neutral colour such as camel, navy or black.\r\n- **Dark, straight-leg jeans** that work dressed up or down.\r\n- **A quality knit sweater** in merino or cashmere blend.\r\n- **Leather or suede boots** you can wear every day.\r\n- **A versatile blazer** that works with jeans and trousers alike.\r\n\r\n## How to pay less for fall fashion\r\n\r\n1. **Shop transitional sales.** Late summer and early autumn sales clear lighter stock, and many stores discount early-season pieces to make room for winter ranges.\r\n2. **Sign up for store newsletters.** Most fashion retailers give a first-order discount when you join their mailing list.\r\n3. **Use a discount code.** Check our [coupon codes](/coupons) before every order. Fashion stores often run site-wide promotions that are not advertised on the homepage.\r\n4. **Join loyalty programmes.** Free memberships often unlock member pricing, birthday offers and free shipping.\r\n5. **Buy staples off-season.** Coats and boots are cheapest at the end of winter. Buy next year\'s basics then and save trend pieces for now.\r\n\r\n## Build outfits, not piles of clothes\r\n\r\nBefore you buy, picture three outfits you could make with the new piece using clothes you already own. If you can, it is a good buy. If you cannot, it is probably an impulse purchase, however good the discount.\r\n\r\n## The bottom line\r\n\r\nThe best autumn wardrobe mixes a few on-trend pieces with quality staples that last. Choose earthy colours and good fabrics, buy with outfits in mind and always check for a [discount code](/categories/fashion) before you pay full price.','blogs/sIS7xnUmig2CKyKfnEJIUQ5DIeuWFvoDsfeYJ4RH.jpg','Fall Fashion Trends & Discount Codes for 2026','This season\'s key fall fashion trends, the wardrobe staples worth buying, and smart ways to pay less with discount codes, end-of-season sales and loyalty perks.','fall fashion trends, autumn fashion, fashion discount codes, fall outfits, wardrobe essentials, fashion sale',0,'Published','2026-09-09 19:00:00','2026-09-29 18:07:07','2026-10-15 16:36:03',NULL);
INSERT INTO `blogs` VALUES (5,12,1,'Electronics Deals Worth Bookmarking','electronics-deals-worth-bookmarking','Laptops, headphones, TVs and smart home gear: when prices drop, which features are worth paying for, and how to stack codes and trade-ins for the biggest savings on tech.','Electronics prices move constantly. The same laptop can cost hundreds more or less depending on the week you buy it. This guide covers the best times to buy each type of tech, the features worth paying for and the simple tricks that bring prices down further.\r\n\r\n> **Shopping now?** Check the latest codes from [Best Buy](/stores/best-buy), [Amazon](/stores/amazon) and [Walmart](/stores/walmart) before you buy.\r\n\r\n## When to buy each type of tech\r\n\r\n### Laptops\r\n\r\nBack-to-school season and the late-autumn sales bring the biggest laptop discounts. New models are often announced in spring, so the previous generation drops in price shortly after.\r\n\r\n### TVs\r\n\r\nThe weeks before major sporting events and the late-autumn sales are the best times to buy. New TV models usually arrive in spring, which pushes last year\'s models down.\r\n\r\n### Headphones and earbuds\r\n\r\nPopular models are discounted often throughout the year. Set a price alert and wait for the dip rather than paying full price.\r\n\r\n### Smart home devices\r\n\r\nSmart speakers, video doorbells and smart plugs are heavily discounted during major retailer sale events, often by a third or more.\r\n\r\n## Features worth paying for\r\n\r\nNot every upgrade is worth the money. Here is where to spend and where to save:\r\n\r\n- **Laptops:** pay for at least 16 GB of memory and a solid-state drive. Save on the highest-end processor unless you edit video or play games.\r\n- **TVs:** pay for a good panel and HDR support. Save on built-in sound if you plan to add a soundbar.\r\n- **Headphones:** pay for comfort and noise cancellation if you commute. Save on premium finishes.\r\n- **Phones:** last year\'s flagship often beats this year\'s mid-range model at a similar price.\r\n\r\n## Ways to pay less\r\n\r\n1. **Buy open-box or refurbished.** Certified refurbished and open-box products are tested, come with a warranty and can be far cheaper than new.\r\n2. **Trade in your old device.** Many retailers and manufacturers give credit for working phones, tablets and laptops.\r\n3. **Use price matching.** Some retailers match competitors\' prices. Check the store\'s policy before you buy elsewhere.\r\n4. **Stack a promo code.** A [coupon code](/coupons) on top of a sale price can add another 5 to 10 percent off.\r\n5. **Check student and member pricing.** Students, teachers and members of retailer programmes often get extra discounts.\r\n\r\n## Don\'t forget the extras\r\n\r\n- **Extended warranties:** often not worth it. Check what the manufacturer and your credit card already cover.\r\n- **Cables and accessories:** buy them separately. Store-brand cables usually work just as well for far less.\r\n- **Return windows:** holiday purchases often get extended return periods, which gives you time to compare prices after you buy.\r\n\r\n## The bottom line\r\n\r\nThe best electronics deal is the right device at the right time. Know when prices usually fall, pay only for the features you will use and check for a [promo code](/categories/electronics) every time. Bookmark this page: we update it as new deals arrive.','blogs/BHP2smlxzD6dpju83qTnPD6a76uNf47wftljBPkF.jpg','Electronics Deals Worth Bookmarking','How to save on laptops, TVs, headphones and smart home devices: the best times to buy, features worth paying for, open-box and refurbished deals, and promo codes.','electronics deals, laptop deals, tv deals, headphones sale, best buy coupon, refurbished electronics',0,'Published','2026-10-14 16:56:08','2026-09-29 18:07:07','2026-10-15 16:36:02',NULL);
/*!40000 ALTER TABLE `blogs` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'store','E-Commerce','e-commerce','Online marketplaces and retailers that sell a bit of everything, with codes and deals to make your cart cheaper.',1,'2026-09-29 18:07:05','2026-10-15 16:28:52');
INSERT INTO `categories` VALUES (2,'store','Fashion','fashion','Clothing, shoes and accessories from sportswear giants to high-street favourites. Find promo codes and sale offers for the brands you wear.',1,'2026-09-29 18:07:05','2026-10-15 16:28:51');
INSERT INTO `categories` VALUES (3,'store','Retail','retail','Big-box and department stores for groceries, home, clothing and everyday essentials, plus the codes that save you more.',1,'2026-09-29 18:07:05','2026-10-15 16:28:48');
INSERT INTO `categories` VALUES (4,'store','Marketplace','marketplace','Marketplaces where independent sellers list new, used and refurbished items. Coupons here often apply to selected categories.',1,'2026-09-29 18:07:05','2026-10-15 16:28:49');
INSERT INTO `categories` VALUES (5,'store','Electronics','electronics','Laptops, TVs, phones, headphones and smart home gear. Promo codes and deals for your next upgrade.',1,'2026-09-29 18:07:05','2026-10-15 16:28:51');
INSERT INTO `categories` VALUES (6,'store','Beauty','beauty','Makeup, skincare, haircare and fragrance. Discount codes and gift-with-purchase offers from beauty retailers.',1,'2026-09-29 18:07:05','2026-10-15 16:28:53');
INSERT INTO `categories` VALUES (8,'store','Food','food','Groceries, snacks, drinks and meal kits. Codes and deals to bring down your food bill.',1,'2026-09-29 18:07:05','2026-10-15 16:28:50');
INSERT INTO `categories` VALUES (9,'blog','Deals','deals','Round-ups of the best current deals and where to find them.',1,'2026-09-29 18:07:05','2026-10-15 16:28:58');
INSERT INTO `categories` VALUES (10,'blog','Fashion','fashion','Seasonal trends, wardrobe staples and how to pay less for them.',1,'2026-09-29 18:07:05','2026-10-15 16:28:57');
INSERT INTO `categories` VALUES (11,'blog','Tips','tips','Practical, repeatable ways to spend less on everyday shopping.',1,'2026-09-29 18:07:05','2026-10-15 16:28:56');
INSERT INTO `categories` VALUES (12,'blog','Electronics','electronics','When to buy tech, what to pay for and how to save on your next device.',1,'2026-09-29 18:07:05','2026-10-15 16:28:57');
INSERT INTO `categories` VALUES (13,'blog','Beauty','beauty','Beauty buys, routines and the smartest ways to save on makeup and skincare.',1,'2026-09-29 18:07:05','2026-10-15 16:28:59');
INSERT INTO `categories` VALUES (14,'store','Travel','travel','Flights, hotels, car hire and holiday essentials. Travel deals and promo codes to help you go further for less.',1,'2026-10-15 11:53:45','2026-10-15 16:28:47');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `coupon_codes` WRITE;
/*!40000 ALTER TABLE `coupon_codes` DISABLE KEYS */;
INSERT INTO `coupon_codes` VALUES (1,13,'DEMO-0001',NULL,NULL,'2026-10-14 18:10:00','2026-10-14 18:10:00');
INSERT INTO `coupon_codes` VALUES (2,13,'DEMO-0002',NULL,NULL,'2026-10-14 18:10:00','2026-10-14 18:10:00');
INSERT INTO `coupon_codes` VALUES (3,13,'DEMO-0003',NULL,NULL,'2026-10-14 18:10:00','2026-10-14 18:10:00');
INSERT INTO `coupon_codes` VALUES (4,14,'DEMO-0001',42,'2026-10-14 18:10:25','2026-10-14 18:10:21','2026-10-14 18:10:25');
INSERT INTO `coupon_codes` VALUES (5,14,'DEMO-0002',43,'2026-10-14 18:10:30','2026-10-14 18:10:21','2026-10-14 18:10:30');
INSERT INTO `coupon_codes` VALUES (6,14,'DEMO-0003',44,'2026-10-14 18:10:38','2026-10-14 18:10:21','2026-10-14 18:10:38');
/*!40000 ALTER TABLE `coupon_codes` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `coupons` WRITE;
/*!40000 ALTER TABLE `coupons` DISABLE KEYS */;
INSERT INTO `coupons` VALUES (1,1,NULL,NULL,NULL,'20% off your order','Coupon Code','SAVE20FALL','Take 20% off eligible items sitewide with this code. Some products and third-party sellers may be excluded, so check the discount in your cart before you pay.',NULL,NULL,'2026-11-01 03:59:59','Active',1,1,0,0,5,NULL,500,18,'2026-09-29 18:07:06','2026-10-15 16:28:33',NULL);
INSERT INTO `coupons` VALUES (2,3,NULL,NULL,NULL,'Free shipping on orders of $50 or more','No Code Required',NULL,'No code needed. Spend $50 or more on eligible items and standard shipping is free. The discount is applied automatically at checkout.',NULL,NULL,'2027-01-01 04:59:59','Active',0,1,0,0,5,NULL,NULL,7,'2026-09-29 18:07:06','2026-10-15 16:28:34',NULL);
INSERT INTO `coupons` VALUES (3,2,NULL,NULL,NULL,'15% off running shoes','Coupon Code','NIKE15RUN','Save 15% on selected Nike running shoes. Paste the code at checkout; new releases and limited editions may not be included.',NULL,NULL,'2026-11-15 04:59:00','Active',1,1,1,0,5,NULL,NULL,4,'2026-09-29 18:07:06','2026-10-15 16:28:36',NULL);
INSERT INTO `coupons` VALUES (4,4,NULL,NULL,NULL,'$25 off orders of $100 or more','Coupon Code','TARGET25','Get $25 off when you spend $100 or more on eligible items. Gift cards and some brands may be excluded.',NULL,NULL,'2026-10-01 03:59:59','Expired',0,0,0,0,5,NULL,NULL,0,'2026-09-29 18:07:06','2026-10-15 16:28:37',NULL);
INSERT INTO `coupons` VALUES (5,5,NULL,NULL,NULL,'Extra 10% off electronics','Deal',NULL,'An extra 10% off selected electronics from participating sellers. The offer page on eBay lists the eligible items and any spending cap.',NULL,NULL,'2026-11-16 04:59:59','Active',1,1,0,0,5,NULL,NULL,3,'2026-09-29 18:07:06','2026-10-15 16:28:39',NULL);
INSERT INTO `coupons` VALUES (6,8,NULL,NULL,NULL,'30% off during the beauty sale','Coupon Code','BEAUTY30','Take 30% off selected makeup, skincare and fragrance while the sale runs. Exclusions may apply to some brands.',NULL,NULL,'2026-12-06 04:59:00','Active',0,1,1,0,5,NULL,NULL,1,'2026-09-29 18:07:06','2026-10-15 16:28:39',NULL);
INSERT INTO `coupons` VALUES (7,6,NULL,NULL,NULL,'$50 off orders of $250 or more','Coupon Code','BBY50OFF','Save $50 when you spend $250 or more on eligible products. Some brands may be excluded; your cart will show the final price.',NULL,NULL,'2026-12-31 04:59:00','Active',1,1,1,0,5,NULL,NULL,34,'2026-09-29 18:07:06','2026-10-15 16:28:40',NULL);
INSERT INTO `coupons` VALUES (8,7,NULL,NULL,NULL,'Buy 2, get 1 free','Deal',NULL,'Add three eligible items to your bag and the lowest-priced one is free. No code needed; the discount appears at checkout.',NULL,NULL,'2026-10-21 03:59:59','Active',1,0,0,0,5,NULL,NULL,0,'2026-09-29 18:07:06','2026-10-15 16:28:42',NULL);
INSERT INTO `coupons` VALUES (9,9,1,'TLTS-10','3fa8eb1632c54eec8e4c7f5f40644bb8cfa8353db15c43ad6a64045208abe2b6','10% off sitewide','Coupon Code','TLTS','Take 10% off everything in the shop with this code.',NULL,NULL,'2026-11-04 19:55:47','Active',0,1,0,0,5,NULL,500,1,'2026-10-05 14:50:04','2026-10-15 16:28:44',NULL);
INSERT INTO `coupons` VALUES (10,9,1,'TLTS-SHIP','7b2b23ffacb7cae40042aa5cc02004bc44699bd0118263e73d70a55305550519','Free shipping on orders over $20','Deal',NULL,'No code needed. Spend over $20 and shipping is on the house.',NULL,NULL,'2026-11-04 19:55:47','Active',0,1,0,0,5,NULL,NULL,1,'2026-10-05 14:50:04','2026-10-15 16:28:45',NULL);
INSERT INTO `coupons` VALUES (13,10,NULL,NULL,NULL,'Demo 20% Off (code list)','Coupon Code',NULL,NULL,NULL,NULL,NULL,'Active',0,0,0,1,2,NULL,3,0,'2026-10-14 18:09:59','2026-10-14 18:10:20','2026-10-14 18:10:20');
INSERT INTO `coupons` VALUES (14,10,NULL,NULL,NULL,'Demo 20% Off (code list)','Coupon Code',NULL,NULL,NULL,NULL,NULL,'Active',0,0,0,1,2,NULL,3,3,'2026-10-14 18:10:20','2026-10-14 18:10:21',NULL);
/*!40000 ALTER TABLE `coupons` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `feed_sources` WRITE;
/*!40000 ALTER TABLE `feed_sources` DISABLE KEYS */;
INSERT INTO `feed_sources` VALUES (1,'Demo Brand (CSV upload)','csv_upload',NULL,NULL,NULL,'manual',0,0,1,'2026-10-05 14:52:49','Completed','2026-10-05 14:33:23','2026-10-05 14:52:49');
/*!40000 ALTER TABLE `feed_sources` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1);
INSERT INTO `migrations` VALUES (2,'0001_01_01_000001_create_cache_table',1);
INSERT INTO `migrations` VALUES (3,'0001_01_01_000002_create_jobs_table',1);
INSERT INTO `migrations` VALUES (4,'2026_09_29_172433_create_personal_access_tokens_table',1);
INSERT INTO `migrations` VALUES (5,'2026_09_29_172615_create_notifications_table',1);
INSERT INTO `migrations` VALUES (6,'2026_09_29_180000_create_catalog_tables',1);
INSERT INTO `migrations` VALUES (7,'2026_09_29_180100_create_commerce_tables',1);
INSERT INTO `migrations` VALUES (8,'2026_09_30_120000_add_coupon_id_to_redemptions_table',1);
INSERT INTO `migrations` VALUES (9,'2026_10_01_100000_create_coupon_codes_table',2);
INSERT INTO `migrations` VALUES (11,'2026_10_05_100000_create_store_ratings_table',3);
INSERT INTO `migrations` VALUES (12,'2026_10_06_100000_add_staff_security_to_users_table',4);
INSERT INTO `migrations` VALUES (13,'2026_10_06_100100_create_activity_logs_table',4);
INSERT INTO `migrations` VALUES (14,'2026_10_06_100200_add_deal_window_and_usage_limit_to_coupons_table',4);
INSERT INTO `migrations` VALUES (15,'2026_10_06_100300_create_feed_sources_table',4);
INSERT INTO `migrations` VALUES (16,'2026_10_15_100000_drop_paid_coupons',5);
INSERT INTO `migrations` VALUES (17,'2026_10_16_100000_add_code_lists_and_commission',6);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'general','{\"site_name\":\"Coupon Follow\",\"support_email\":null,\"timezone\":\"America\\/New_York\"}','2026-10-05 13:42:50','2026-10-16 12:28:59');
INSERT INTO `settings` VALUES (2,'homepage','{\"headline\":\"Save more at the stores you love.\",\"subtext\":\"Free promo codes and deals from brands like Amazon, Nike and Sephora. Find your store, copy the code, and save at checkout.\",\"search_placeholder\":\"Search Nike, Amazon, Sephora\\u2026\",\"hero_image\":\"homepage\\/umUcpXsrWOEoNEgqHqTnIXkNRPp3aSTi1qtyOlkV.jpg\",\"slides\":[{\"image\":\"homepage\\/L7dDq2Kmp7QqwT0C42lWgflJvNEaDrAnxv8xHpqr.jpg\",\"title\":\"Beauty savings at Sephora\",\"subtitle\":\"Discounts on makeup, skincare and fragrance.\",\"button_text\":\"See Sephora codes\",\"link\":\"\\/stores\\/sephora\"},{\"image\":\"homepage\\/AMgmstnSEOTIyCaaXtkRcl0nQUDUDCD7UkcqL9Hj.jpg\",\"title\":\"Tech deals worth a look\",\"subtitle\":\"Promo codes on laptops, TVs and headphones.\",\"button_text\":\"Browse coupons\",\"link\":\"\\/coupons\"},{\"image\":\"homepage\\/BHFcxUhrLbcBDHlyyU72cRsBewxD9pHQ0lSQY6gU.jpg\",\"title\":\"Fashion finds for less\",\"subtitle\":\"Codes from the fashion brands you wear.\",\"button_text\":\"Shop fashion\",\"link\":\"\\/categories\\/fashion\"}]}','2026-10-15 14:26:22','2026-10-16 12:29:07');
INSERT INTO `settings` VALUES (3,'seo','{\"meta_title\":\"Coupon Follow: Promo Codes & Deals for Top Stores\",\"meta_description\":\"Free promo codes and deals for Amazon, Walmart, Nike, Sephora and more. Reveal a code, shop in a new tab and save at checkout. No sign-up needed.\",\"meta_keywords\":\"coupon codes, promo codes, discount codes, deals, amazon coupons, walmart coupons, nike promo code\"}','2026-10-15 16:29:00','2026-10-16 12:29:12');
INSERT INTO `settings` VALUES (4,'notifications','{\"email\":true,\"sync_alerts\":true,\"redemption_alerts\":false}','2026-10-15 19:57:21','2026-10-16 12:29:18');
INSERT INTO `settings` VALUES (5,'security','{\"require_two_factor\":false}','2026-10-16 16:11:14','2026-10-16 16:11:14');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `stores` WRITE;
/*!40000 ALTER TABLE `stores` DISABLE KEYS */;
INSERT INTO `stores` VALUES (1,1,'Amazon','amazon','Amazon coupons & promo codes','Everything from groceries to gadgets, usually delivered fast. Use these Amazon promo codes and deals to take a little more off your order.','Amazon sells almost anything you can think of, from household basics and books to electronics, fashion and groceries. With millions of products and sellers, prices change often, which is good news if you know where to look.\n\n## How to use an Amazon promo code\n\n1. Click **Show coupon code** on the offer you want. Amazon opens in a new tab.\n2. Add your items to your cart and go to checkout.\n3. Paste the code in the *Gift cards & promotional codes* box and apply it before you place your order.\n\nSome Amazon offers are clippable coupons on the product page rather than codes. Tick the coupon box under the price before you add the item to your cart.\n\n## More ways to save at Amazon\n\n- **Subscribe & Save** takes money off items you buy regularly, and the discount can grow when you bundle several subscriptions.\n- **Renewed and Amazon Resale** offer tested, pre-owned and open-box items for less.\n- **Today\'s Deals** collects time-limited offers in one place, so check it before you buy anything over $50.\n- **Prime members** get member-only prices during Amazon\'s big sale events.\n\n> **Tip:** compare sellers on the same product. The cheapest listing is not always the best deal once shipping and return policies are counted.','https://amazon.com','https://track.couponfollow.com/amazon',NULL,'Amazon Promo Codes & Coupons','The latest Amazon promo codes and deals. Reveal a code, shop in a new tab and paste it at checkout. Free to use.','amazon promo code, amazon coupon, amazon deals, amazon discount',1,1,'Active','2026-09-29 18:07:06','2026-10-15 16:28:32',NULL,NULL);
INSERT INTO `stores` VALUES (2,2,'Nike','nike','Nike coupons & promo codes','Running shoes, training gear and everyday sneakers from the brand athletes trust. Grab a Nike promo code before you check out.','Nike makes footwear, clothing and equipment for running, training, basketball, football and everyday wear. Its range runs from entry-level trainers to race-day super shoes, and new colourways arrive every season.\n\n## How to use a Nike promo code\n\n1. Click **Show coupon code** and Nike opens in a new tab.\n2. Add your items to your bag and select *Checkout*.\n3. Enter the code in the *Promo code* field and apply it before you pay.\n\nSome products, such as new releases and limited editions, may be excluded from promotions. The checkout will show if a code doesn\'t apply.\n\n## More ways to save at Nike\n\n- **Join Nike Membership.** It\'s free and gives you member-only offers, early access to sales and birthday rewards.\n- **Shop the sale section.** Previous seasons\' colourways are often discounted while still being the same shoe.\n- **Look at the last version.** When a new model launches, the one before it usually drops in price.\n- **Check for student and military discounts** if they apply to you.\n\n> **Tip:** buy for fit first. Check Nike\'s sizing notes on each product page and keep the box until you\'ve tried them indoors.','https://nike.com','https://track.couponfollow.com/nike',NULL,'Nike Promo Codes & Discounts','Current Nike promo codes and sale offers on shoes, clothing and gear. Reveal a code, shop Nike in a new tab and save at checkout.','nike promo code, nike coupon, nike discount, nike sale, nike running shoes',1,0,'Active','2026-09-29 18:07:06','2026-10-15 16:28:22',NULL,NULL);
INSERT INTO `stores` VALUES (3,3,'Walmart','walmart','Walmart coupons & promo codes','Low everyday prices on groceries, home goods, electronics and more. Stack a Walmart promo code on top for extra savings online.','Walmart is one of the largest retailers in the United States, known for low prices on groceries, household essentials, electronics, toys, clothing and home goods. You can shop in store, order online, or choose pickup and delivery.\n\n## How to use a Walmart promo code\n\n1. Click **Show coupon code** and Walmart opens in a new tab.\n2. Add items to your cart and go to checkout.\n3. Enter the code in the promo code box and apply it before placing your order.\n\nDeals marked *No code required* apply automatically when you shop through the link.\n\n## More ways to save at Walmart\n\n- **Rollbacks** are temporary price cuts that can last for weeks. Stock up on pantry items when they\'re on Rollback.\n- **Clearance** prices drop further over time, especially on seasonal goods.\n- **Store brands** like Great Value and Equate cost noticeably less than name brands.\n- **Walmart+** members get free delivery on qualifying orders and other perks, which pays off if you order often.\n\n> **Tip:** choose pickup instead of browsing the aisles. Shopping from a list keeps impulse buys out of your cart.','https://walmart.com','https://track.couponfollow.com/walmart',NULL,'Walmart Promo Codes & Deals','Save at Walmart with current promo codes and deals on groceries, home and electronics. Free to use, no sign-up needed.','walmart promo code, walmart coupon, walmart deals, walmart free shipping',0,1,'Active','2026-09-29 18:07:06','2026-10-15 16:28:30',NULL,NULL);
INSERT INTO `stores` VALUES (4,3,'Target','target','Target coupons & promo codes','Style, home, beauty and everyday essentials at prices that make sense. Check here for Target promo codes before you pay.','Target combines everyday essentials with well-designed own brands across home, clothing, beauty, toys, electronics and groceries. Many shoppers know it for its seasonal collections and designer partnerships.\n\n## How to use a Target promo code\n\n1. Click **Show coupon code** and Target opens in a new tab.\n2. Add items to your cart and go to checkout.\n3. Enter the code in the *Promo code* field and apply it before you place your order.\n\n## More ways to save at Target\n\n- **Target Circle** is free to join and unlocks personalised deals and a birthday reward.\n- **Own brands** across home, clothing and essentials often cost less than similar name brands.\n- **Seasonal clearance** after holidays and at the end of each season can be deeply discounted.\n- **Drive Up and Order Pickup** are free on eligible orders and help you avoid shipping costs.\n\n> **Tip:** add Target Circle offers to your account before you shop. They often stack with a promo code and sale prices.','https://target.com','https://track.couponfollow.com/target',NULL,'Target Promo Codes & Coupons','Find Target promo codes and deals on home, clothing, beauty and essentials. Reveal a code and save at Target checkout.','target promo code, target coupon, target circle, target deals',0,0,'Active','2026-09-29 18:07:06','2026-10-15 16:28:29',NULL,NULL);
INSERT INTO `stores` VALUES (5,4,'eBay','ebay','eBay coupons & promo codes','New, used and refurbished items from sellers around the world. Use an eBay coupon to pay less on eligible listings.','eBay is a global marketplace where you can buy new, used and refurbished items from businesses and individual sellers. It\'s especially popular for electronics, collectibles, car parts, fashion and hard-to-find items.\n\n## How to use an eBay coupon\n\n1. Click **Show coupon code** and eBay opens in a new tab.\n2. Add eligible items to your cart and go to checkout.\n3. Enter the code under *Gift cards, coupons, eBay Bucks* and apply it before you pay.\n\neBay coupons often apply only to certain categories or sellers, and they may have a minimum spend. The coupon terms on eBay explain the details.\n\n## More ways to save on eBay\n\n- **eBay Refurbished** offers inspected items with a warranty.\n- **Make an offer** on listings that allow it. Sellers often accept a reasonable price.\n- **Save searches** to get alerts when new listings match what you want.\n- **Check the seller\'s feedback** and return policy before you buy.\n\n> **Tip:** sort results by price plus shipping, not price alone, so the total cost is clear.','https://ebay.com','https://track.couponfollow.com/ebay',NULL,'eBay Coupons & Promo Codes','Current eBay coupon codes and deals on electronics, collectibles, fashion and more. Reveal a code and save at checkout.','ebay coupon, ebay promo code, ebay deals, ebay refurbished',1,0,'Inactive','2026-09-29 18:07:06','2026-10-15 16:28:23',NULL,NULL);
INSERT INTO `stores` VALUES (6,5,'Best Buy','best-buy','Best Buy coupons & promo codes','Laptops, TVs, phones, appliances and the advice to choose well. Use a Best Buy promo code to take more off your next upgrade.','Best Buy is a leading electronics retailer selling computers, TVs, phones, gaming, smart home devices and major appliances, along with setup and repair services.\n\n## How to use a Best Buy promo code\n\n1. Click **Show coupon code** and Best Buy opens in a new tab.\n2. Add your items to your cart and select *Checkout*.\n3. Enter the code in the promo code field and apply it before you place your order.\n\nPromo codes may not apply to certain brands or products. Your cart will show if an item is excluded.\n\n## More ways to save at Best Buy\n\n- **Open-box items** are returned products, inspected and sold at a discount.\n- **Trade in** your old phone, tablet or laptop for credit toward something new.\n- **My Best Buy** membership is free and gives you member deals and rewards.\n- **Student deals** offer extra savings on laptops and tech for school.\n\n> **Tip:** new models usually launch in spring. Buying the previous generation soon after is one of the easiest ways to save on TVs and laptops.','https://bestbuy.com','https://track.couponfollow.com/best-buy',NULL,'Best Buy Promo Codes & Deals','Save on laptops, TVs, headphones and appliances with Best Buy promo codes and deals. Reveal a code and save at checkout.','best buy promo code, best buy coupon, best buy deals, electronics deals',0,0,'Active','2026-09-29 18:07:06','2026-10-15 16:28:29',NULL,NULL);
INSERT INTO `stores` VALUES (7,2,'Adidas','adidas','Adidas coupons & promo codes','Performance footwear, sportswear and the classic three stripes. Find adidas promo codes and sale offers here.','adidas designs footwear, clothing and accessories for running, football, training and lifestyle, from performance shoes to classic Originals sneakers.\n\n## How to use an adidas promo code\n\n1. Click **Show coupon code** and adidas opens in a new tab.\n2. Add items to your bag and go to checkout.\n3. Enter the code in the *Promo code* field and apply it before you pay.\n\nNew releases and some collaborations are often excluded from promotions.\n\n## More ways to save at adidas\n\n- **adiClub** membership is free and earns points you can turn into discounts.\n- **The sale section** carries past-season styles at reduced prices.\n- **Outlet** products offer further markdowns on selected lines.\n- **Student discounts** may be available through verification.\n\n> **Tip:** adiClub members often get early access to sales, so join before a big sale weekend.','https://adidas.com','https://track.couponfollow.com/adidas',NULL,'adidas Promo Codes & Discounts','Current adidas promo codes and deals on shoes, clothing and accessories. Reveal a code, shop adidas and save at checkout.','adidas promo code, adidas coupon, adidas sale, adidas discount',0,0,'Inactive','2026-09-29 18:07:06','2026-10-15 16:28:27',NULL,NULL);
INSERT INTO `stores` VALUES (8,6,'Sephora','sephora','Sephora coupons & promo codes','Makeup, skincare, haircare and fragrance from the brands beauty fans love. Pick up a Sephora promo code before you check out.','Sephora is a beauty retailer with a huge range of makeup, skincare, haircare, fragrance and tools, from prestige brands to its own Sephora Collection.\n\n## How to use a Sephora promo code\n\n1. Click **Show coupon code** and Sephora opens in a new tab.\n2. Add your products to your basket and go to checkout.\n3. Enter the code in the promo code field and apply it before you place your order.\n\nSome codes unlock a free gift or sample with purchase rather than a price discount.\n\n## More ways to save at Sephora\n\n- **Beauty Insider** is free and earns points on every purchase, plus a birthday gift.\n- **Seasonal savings events** offer tiered discounts for members, so plan bigger purchases around them.\n- **Sephora Collection** products deliver good quality at lower prices.\n- **Mini sizes and value sets** let you try products before buying full size.\n\n> **Tip:** pick free samples at checkout. It\'s the easiest way to test a new foundation shade or fragrance before you commit.','https://sephora.com','https://track.couponfollow.com/sephora',NULL,'Sephora Promo Codes & Coupons','Sephora promo codes and deals on makeup, skincare and fragrance. Reveal a code, shop Sephora in a new tab and save at checkout.','sephora promo code, sephora coupon, sephora sale, beauty insider',1,1,'Active','2026-09-29 18:07:06','2026-10-15 16:28:26',NULL,NULL);
INSERT INTO `stores` VALUES (9,NULL,'The Loaded Tea Shop','the-loaded-tea-shop',NULL,NULL,NULL,'https://theloadedteashop.com',NULL,NULL,NULL,NULL,NULL,0,0,'Inactive','2026-10-05 14:50:04','2026-10-15 16:28:24',NULL,NULL);
INSERT INTO `stores` VALUES (10,NULL,'Demo Code List Store','demo-code-list-store',NULL,NULL,NULL,'https://example.com',NULL,NULL,NULL,NULL,NULL,0,0,'Inactive','2026-10-14 18:09:59','2026-10-15 16:28:20',NULL,8.00);
/*!40000 ALTER TABLE `stores` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

UPDATE coupon_codes SET redemption_id = NULL, assigned_at = NULL;
UPDATE coupons SET uses_count = 0;
UPDATE feed_sources SET api_key = NULL, last_run_at = NULL, last_status = NULL;
