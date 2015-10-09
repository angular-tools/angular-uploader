(function () {
    'use strict';

    var scripts = document.getElementsByTagName("script");
    var currentScriptPath = scripts[scripts.length - 1].src;
    var basePath = currentScriptPath.substring(0, currentScriptPath.lastIndexOf('/') + 1) + '..';
    var uploaderURL = '/generic/uploader';

    angular.module('angularUploader', ['ngFileUpload', 'session', 'ngDialog', 'angularStringFilters', 'angularThumb', 'angularAudio'])
        .factory('$musicUploader', ['ngDialog', '$timeout', function ($dialog, $timeout) {
            var audioUploader = {};
            var baseURL = 'http://www.bgtracks.com';

            audioUploader.show = function (cb, sound, hideTunes, hideSfx, defaultTab) {
                $dialog.open({
                    template: basePath + '/templates/audio-popup.html',
                    className: 'ngdialog-theme-plain',
                    controller: ['$scope', function ($scope) {
                        $scope.obj = {};
                        $scope.obj.sound = sound || '';
                        $scope.hideTunes = !!hideTunes;
                        $scope.hideSfx = !!hideSfx;

                        $scope.init = function () {
                            $.getJSON(baseURL + '/api/sfxs?sort=genre' + '&callback=?', function (obj) {
                                console.log(obj);
                                $timeout(function () { $scope.sfxs = obj; });
                            });

                            $.getJSON(baseURL + '/api/tracks?sort=genre' + '&callback=?', function (obj) {
                                console.log(obj);
                                $timeout(function () { $scope.tracks = obj; });
                            });

                            $.getJSON(baseURL + '/api/resources?sort=popularity&callback=?', function (obj) {
                                $timeout(function () { $scope.resources = obj; });
                            });

                            if (defaultTab) {
                                $timeout(function () { $('a[href="#' + defaultTab + '"').click(); }, 500);
                            }
                        };

                        $scope.absoluteURL = function (u) {
                            return /^http/i.test(u) ? u : baseURL + u;
                        };

                        $scope.save = function () {
                            $timeout(function () { cb($scope.obj.sound || null); });
                            $scope.closeThisDialog();
                        };

                        $scope.init();
                    }]
                });
            };

            return audioUploader;
        }])
        .factory('$mediaUploader', ['Upload', 'ngDialog', '$timeout', '$notice', '$q', '$http', function ($upload, $dialog, $timeout, $notice, $q, $http) {
            var mediaUploader = {};

            mediaUploader.show = function (cb, term, defaultTab, withCaptions) {
                var promises = [];
                var imageSearch;

                var abortAll = function () {
                    angular.forEach(promises, function (upload) {
                        upload.abort();
                    });

                    promises = [];
                };

                $dialog.open({
                    template: basePath + '/templates/media-popup.html',
                    className: 'ngdialog-theme-plain custom-width',
                    controller: ['$scope', function ($scope) {
                        abortAll();
                        $scope.uploading = false;
                        $scope.term = term || '';
                        $scope.imageResults = [];
                        $scope.sources = {};
                        $scope.urls = [];
                        $scope.license = 'any';

                        $scope.init = function () {
                            $scope.$watch('sources', function () {
                                $scope.urls.splice(0, $scope.urls.length);

                                angular.forEach($scope.sources, function (v, k) {
                                    if (v) {
                                        $scope.urls.push(k);
                                    }
                                });
                            }, true);

                            if (defaultTab) {
                                $timeout(function () {
                                    $('a[href="#' + defaultTab + '"').click();

                                    if (term) {
                                        $('#' + defaultTab + '-button').click();
                                    }
                                }, 500);
                            }
                        };

                        $scope.upload = function (files) {
                            if (files && files.length) {
                                $scope.uploading = true;

                                var results = [];
                                var total = 0;

                                var done = function () {
                                    $scope.uploading = false;

                                    angular.forEach(results, function (v, k) {
                                        $scope.sources[v] = true;
                                    });
                                };

                                for (var i = 0; i < files.length; i++) {
                                    var file = files[i];
                                    var promise = $upload.upload({url: uploaderURL, file: file});

                                    promise.success(function (obj, status, headers, config) {
                                        if (obj && obj.url) {
                                            results.push(obj.url);

                                            $timeout(function () {
                                                $('#selectedTab').popover({
                                                    trigger: 'manual',
                                                    title: 'Upload complete',
                                                    content: "File " + config.file.name + " was uploaded successfully."
                                                }).popover('show');
                                                $timeout(function () { $('#selectedTab').popover('destroy'); }, 5000);
                                            }, 1000);
                                        }
                                    });

                                    promise.error(function (data, status, headers, config) {
                                        $notice.error("Sorry, " + config.file.name + " could not be uploaded");
                                    });

                                    promise.progress(function (evt) {
                                        $scope.file = evt.config.file.name;
                                    });

                                    promises.push(promise);
                                }

                                $q.all(promises).then(done, done)
                            }
                        };

                        $scope.loadImages = function (term) {
                            if (typeof(window.imageSearch) !== 'undefined') {
                                $scope.searchImages(term);
                            } else {
                                if (typeof(google) !== 'undefined') {
                                    google.load('search', '1', {'callback': 'window.imageSearch = google.search.ImageSearch;'});
                                }

                                setTimeout($scope.loadImages, 1000, term);
                            }
                        };

                        $scope.searchImages = function (term) {
                            $scope.imageResults = [];
                            $scope.moreImages = false;

                            imageSearch = new window.imageSearch();
                            imageSearch.setSearchCompleteCallback(this, function () {
                                angular.forEach(imageSearch.results, function (result) {
                                    $scope.imageResults.push({thumb: result.tbUrl, src: result.url, caption: result.contentNoFormatting});
                                });

                                $timeout(function () {
                                    var cursor = imageSearch.cursor;
                                    var totalPages = cursor.pages.length;

                                    $scope.moreImages = cursor.currentPageIndex < totalPages - 1 ? cursor.currentPageIndex + 1 : false;
                                });
                            }, null);

                            imageSearch.setResultSetSize(8);
                            imageSearch.setNoHtmlGeneration();

                            if ($scope.license === 'creativeCommon') {
                                imageSearch.setRestriction(window.imageSearch.RESTRICT_RIGHTS, window.imageSearch.RIGHTS_REUSE);
                            }

                            imageSearch.execute(term);
                        };

                        $scope.loadMoreImages = function () {
                            if ($scope.moreImages > 0) {
                                imageSearch.gotoPage($scope.moreImages);
                            }
                        };

                        $scope.loadVideos = function (term) {
                            if (typeof(window.videoSearch) !== 'undefined') {
                                $scope.searchVideos(term);
                            } else {
                                if (typeof(gapi) !== 'undefined') {
                                    gapi.client.load('youtube', 'v3', function () {window.videoSearch = gapi.client.youtube.search.list;});
                                }
                                setTimeout($scope.loadVideos, 1000, term);
                            }
                        };

                        $scope.searchVideos = function (term, token) {
                            $scope.moreVideos = false;

                            var api_key = 'AIzaSyCBdyG0mb-kaxrHkY3bH3LmPGqigFrEtVg ';
                            var params = {key: api_key, type: 'video', q: term, part: 'snippet', videoLicense: $scope.license || 'any', videoEmbeddable: true, maxResults: 24};

                            if (token) {
                                params['pageToken'] = token;
                            } else {
                                $scope.videoResults = [];
                            }

                            var request = window.videoSearch(params);

                            request.execute(function (response) {
                                console.log(response);
                                angular.forEach(response.items, function (result) {
                                    $scope.videoResults.push({
                                        thumb: result.snippet.thumbnails.default.url,
                                        src: 'http://www.youtube.com/watch?v=' + result.id.videoId,
                                        caption: result.snippet.title
                                    });
                                });

                                $timeout(function () {$scope.moreVideos = response.nextPageToken ? response.nextPageToken : false;});
                            });
                        };

                        $scope.itemType = function (url) {
                            return (/youtube\.com/i.test(url) || /(\.mp4)$/.test(url)) ? 'video' : 'photo';
                        };

                        $scope.save = function () {
                            if (($scope.urls.length > 0) && (cb instanceof Function)) {
                                var proxy = [];
                                for (var i = $scope.urls.length - 1; i >= 0; i--) {
                                    var url = $scope.urls[i];
                                    if (($scope.itemType(url) === 'photo') && !/s3\.amazonaws\.com/i.test(url)) {
                                        proxy.push(url);
                                        $scope.urls.splice(i, 1);
                                    }
                                }

                                if (proxy.length > 0) {
                                    $scope.processing = true;

                                    $http.post('/generic/url-proxy', {urls: proxy}).then(
                                        function success(obj) {
                                            if ($scope.processing) {
                                                var urls = obj.data;
                                                if (urls && urls.length > 0) {
                                                    angular.forEach(urls, function (url) {
                                                        if (url && url.copy) {
                                                            $scope.urls.push(url.copy);
                                                            angular.extend(_.findWhere($scope.imageResults, {src: url.src}) || {}, {src: url.copy});
                                                        }
                                                    });
                                                }

                                                $scope.addURLs();
                                            }
                                        },
                                        $scope.addURLs
                                    );
                                } else {
                                    $scope.addURLs();
                                }
                            } else {
                                $scope.closeThisDialog();
                            }
                        };

                        $scope.abort = function () {
                            $scope.processing = false;
                        };

                        $scope.addURLs = function () {
                            var urls = $scope.urls;
                            var results = [];

                            if (withCaptions) {
                                angular.forEach(urls, function (url) {
                                    results.push(_.findWhere($scope.videoResults, {src: url}) || _.findWhere($scope.imageResults, {src: url}) || {url: url});
                                });
                            } else {
                                results = results.concat(urls);
                            }

                            $timeout(function () { cb(results); });
                            $scope.closeThisDialog();
                        };

                        $scope.init();
                    }],
                    preCloseCallback: abortAll
                });
            };

            return mediaUploader;
        }])
        .directive('sfxButton', ['$musicUploader', function ($musicUploader) {
            return {
                restrict: 'A',
                require: 'ngModel',
                scope: {},
                link: function ($scope, element, attrs, ngModel) {
                    element.click(function () {
                        $musicUploader.show(function save(url) {
                            ngModel.$setViewValue(url);
                        }, ngModel.$viewValue, true, false);
                    });
                }
            }
        }])
        .directive('musicButton', ['$musicUploader', function ($musicUploader) {
            return {
                restrict: 'A',
                require: 'ngModel',
                scope: {},
                link: function ($scope, element, attrs, ngModel) {
                    element.click(function () {
                        $musicUploader.show(function save(url) {
                            ngModel.$setViewValue(url);
                        }, ngModel.$viewValue, false, true);
                    });
                }
            }
        }])
        .directive('uploadButton', ['Upload', '$timeout', '$notice', function ($upload, $timeout, $notice) {
            return {
                restrict: 'A',
                replace: true,
                require: 'ngModel',
                scope: {btnText: '@', btnClass: '@', onUpload: '=', onProgress: '=', type: '@', preview: '@', hideRemove: '='},
                templateUrl: basePath + '/templates/upload-button.html',
                link: function ($scope, element, attrs, ngModel) {
                    $scope.init = function () {
                        $scope.url = ngModel.$viewValue;
                        $scope.$watch('url', function () {
                            ngModel.$setViewValue($scope.url);
                        });

                        if (($scope.preview === 'popup') && (!$scope.type || ($scope.type === 'image'))) {
                            $(element).popover({
                                container: 'body',
                                html: true,
                                template: '<div class="popover" role="tooltip"><div class="arrow"></div><div class="popover-content"></div></div>',
                                content: function () { return '<p>Current image:</p><img src="' + $scope.url + '" style="max-width:200px;max-height:200px;">'; },
                                placement: 'top'
                            });

                            $(element).hover(function () {
                                if ($scope.url) {
                                    $(element).popover('show');
                                }
                            }, function () {
                                $(element).popover('hide');
                            });
                        }
                    };

                    ngModel.$render = $scope.init;
                },
                controller: function ($scope, $element) {
                    $scope.files = [];
                    $scope.url = '';
                    $scope.uploading = false;

                    $scope.startUpload = function (files) {
                        if (files && files.length) {
                            var file, i;

                            $scope.uploading = files.length > 0;

                            for (i = 0; i < files.length; i++) {
                                file = files[i];

                                var promise = $upload.upload({
                                    url: uploaderURL,
                                    headers: {'Content-Type': file.type},
                                    method: 'POST',
                                    data: file,
                                    file: file
                                });

                                promise.then($scope.uploadDone, $scope.uploadDone);
                                promise.then($scope.success, $scope.error, $scope.progress);
                            }
                        }
                    };

                    $scope.uploadDone = function () {
                        $scope.uploading = false;
                    };

                    $scope.getType = function (t) {
                        return (!t || /image/i.test(t)) ? 'image/*' : /vid/i.test(t) ? 'video/*' : /(audio|sound)/i.test(t) ? 'audio/*' : /html/i.test(t) ? 'text/html' : /pdf/i.test(t) ? 'application/pdf' : '';
                    };

                    $scope.success = function (obj) {
                        if (obj && obj.data && obj.data.url && obj.status === 200) {
                            $scope.url = obj.data.url;

                            $scope.progress({loaded: 100, total: 99});

                            $timeout(function () {
                                if (typeof($scope.onUpload) === 'function') {
                                    $scope.onUpload($scope.url);
                                }
                            });
                        } else {
                            $scope.error(obj);
                        }
                    };

                    $scope.error = function (obj) {
                        $notice.error('Upload failed: ' + (obj && obj.data ? obj.data : ''), 'Upload error', 'error');
                    };

                    $scope.progress = function (evt) {
                        if ((typeof($scope.onProgress) == 'function') && (evt.total > 0)) {
                            $scope.onProgress((evt.loaded / evt.total) * 99);
                        }
                    };
                }
            };
        }])
    ;
})
();


