<?php

namespace App\Exceptions;

use RuntimeException;

/** A feed row the importer skips, with a message for the admin. */
class FeedRowError extends RuntimeException {}
